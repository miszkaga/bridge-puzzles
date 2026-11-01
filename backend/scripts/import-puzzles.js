#!/usr/bin/env node
/**
 * Import zagadek jednokolorowych z pliku .docx / .txt do Supabase.
 *
 *   node scripts/import-puzzles.js "Kolory do apki.docx"                      # dry-run (nic nie zapisuje)
 *   node scripts/import-puzzles.js "Kolory do apki.docx" --commit             # zapis do bazy
 *   node scripts/import-puzzles.js "Kolory do apki.docx" --commit --update    # + nadpisuje istniejące
 *
 * Opcje: --suit S|H|D|C  --type puzzle|defense  --difficulty easy|medium|hard  --limit N
 *
 * Dedukcja, czy zagadka już jest w bazie, liczy się z hasha treści (import_key), nie
 * z numeru w pliku. --update nadpisuje treść (solution_tree, kontrakt, trudność, typ)
 * dopasowanych po tym hashu wierszy, ale zostawia ich is_active bez zmian — poprawka
 * opisu nie ma cofać zagadki już przejrzanej i włączonej.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const { createClient } = require('@supabase/supabase-js');

// ---------- konfiguracja z CLI ----------
const argv = process.argv.slice(2);
const file = argv.find((a) => !a.startsWith('--'));
const flag = (name, fallback) => {
    const i = argv.indexOf(`--${name}`);
    return i !== -1 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : fallback;
};
const COMMIT = argv.includes('--commit');
const UPDATE = argv.includes('--update');
const SUIT = flag('suit', 'S');
const TYPE = flag('type', 'puzzle');
const DIFFICULTY = flag('difficulty', 'medium');
const LIMIT = parseInt(flag('limit', '0'), 10);

if (!file) {
    console.error('Użycie: node scripts/import-puzzles.js <plik.docx|.txt> [--commit]');
    process.exit(1);
}

// ---------- karty ----------
// Polskie oznaczenia -> rangi używane w bazie (zgodnie z istniejącymi zagadkami: SA, SQ, SK)
const RANK_PL = { A: 'A', K: 'K', D: 'Q', W: 'J' };
const ALL_RANKS = ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2'];
const toRank = (t) => RANK_PL[t] || t;

function parseHolding(text) {
    // "AW10xxx" -> A, W, 10, x, x, x   ("10" musi być dopasowane przed pojedynczymi cyframi)
    return (text.trim().match(/10|[AKDW]|[2-9]|x/g) || []).map((t) => ({ token: t, isX: t === 'x' }));
}

// ---------- wejście ----------
function readSource(path) {
    if (!path.toLowerCase().endsWith('.docx')) return fs.readFileSync(path, 'utf8');

    const xml = execFileSync('unzip', ['-p', path, 'word/document.xml'], {
        encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
    });
    // Każdy <w:p> to akapit; tekst bywa rozbity na wiele <w:t>
    return (xml.match(/<w:p[ >][\s\S]*?<\/w:p>/g) || [])
        .map((p) => (p.match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g) || [])
            .map((t) => t.replace(/<[^>]+>/g, ''))
            .join('')
            .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"').replace(/&apos;/g, "'"))
        .join('\n');
}

// ---------- parsowanie ----------
function parseBlocks(text) {
    const blocks = [];
    let cur = null;
    for (const line of text.split('\n')) {
        if (/^\s*\d+\.\s*$/.test(line)) {
            if (cur) blocks.push(cur);
            cur = { label: line.trim(), lines: [] };
        } else if (cur) cur.lines.push(line);
    }
    if (cur) blocks.push(cur);
    return blocks;
}

const SUIT_ALIAS = {
    '♠': 'S', S: 'S', PIK: 'S', PIKI: 'S',
    '♥': 'H', H: 'H', KIER: 'H', KIERY: 'H',
    '♦': 'D', D: 'D', KARO: 'D', KARA: 'D',
    '♣': 'C', C: 'C', TREFL: 'C', TREFLE: 'C',
};

function parseBlock(block, index) {
    const seats = {};
    const seatOrder = [];
    const prose = [];
    const wrong = [];
    let contract = null, declarer = null, target = null, answer = null;
    let defender = null, suit = null, lead = null, difficulty = null;

    for (const raw of block.lines) {
        const line = raw.trim();
        if (!line) continue;
        let m;
        if ((m = line.match(/^([NESW]):\s*(.+)$/))) {
            seats[m[1]] = parseHolding(m[2]);
            seatOrder.push(m[1]);
        } else if ((m = line.match(/^Kontrakt:\s*(.+)$/i))) contract = m[1].trim();
        else if ((m = line.match(/^Rozgrywaj[ąa]cy:\s*(.+)$/i))) declarer = m[1].trim();
        else if ((m = line.match(/^Lewy do wzi[ęe]cia na obronie:\s*(\d+)/i))) target = +m[1];
        else if ((m = line.match(/^(?:Rozwi[ąa]zanie|Dobre):\s*(.+)$/i))) answer = m[1].trim();
        else if ((m = line.match(/^Broni[ąa]cy:\s*([NESW])/i))) defender = m[1].toUpperCase();
        else if ((m = line.match(/^Kolor:\s*(.+)$/i))) suit = SUIT_ALIAS[m[1].trim().toUpperCase()] || null;
        else if ((m = line.match(/^Wysz[łl]o:\s*(.+)$/i))) lead = m[1].trim();
        else if ((m = line.match(/^Trudno[śs][ćc]:\s*(\w+)/i))) difficulty = m[1].toLowerCase();
        else if ((m = line.match(/^Z[łl]e:\s*(.+)$/i))) wrong.push(m[1].trim());
        else prose.push(line);
    }

    // 3BA to polski zapis bez atu
    if (contract) contract = contract.replace(/^(\d)\s*BA$/i, '$1NT');

    return {
        index, label: block.label, seats, seatOrder, contract, declarer, target, answer,
        suit, lead, difficulty, wrong,
        // Konwencja formatu: N (dziadek), broniący, S (rozgrywający), partner
        defender: defender || seatOrder[1] || null,
        explanation: prose.join(' ').trim(),
    };
}

// ---------- budowa zagadki ----------
function buildPuzzle(p) {
    const errors = [];
    if (Object.keys(p.seats).length !== 4) errors.push('brak kompletu czterech rąk');
    if (!p.contract) errors.push('brak kontraktu');
    if (!p.declarer) errors.push('brak rozgrywającego');
    if (!p.answer) errors.push('brak linii "Rozwiązanie:" — nie da się zbudować drzewa odpowiedzi');
    if (!p.defender) errors.push('nie ustalono broniącego');

    const flat = Object.values(p.seats).flat();
    const named = flat.filter((c) => !c.isX).map((c) => toRank(c.token));
    const dupes = named.filter((r, i) => named.indexOf(r) !== i);
    if (flat.length !== 13) errors.push(`${flat.length} kart zamiast 13`);
    if (dupes.length) errors.push(`powtórzone figury: ${dupes.join(', ')}`);

    // Blotki: wolne rangi rozdzielane malejąco, w kolejności występowania pozycji w dokumencie
    const free = ALL_RANKS.filter((r) => !named.includes(r));
    if (flat.filter((c) => c.isX).length !== free.length) {
        errors.push('liczba blotek nie zgadza się z liczbą wolnych rang');
    }

    const suit = p.suit || SUIT;
    const pool = [...free];
    const hands = {};
    const spotsOf = {};
    for (const seat of p.seatOrder) {
        spotsOf[seat] = [];
        hands[seat] = p.seats[seat].map((c) => {
            const rank = c.isX ? pool.shift() : toRank(c.token);
            const code = suit + rank;
            if (c.isX) spotsOf[seat].push(code);
            return code;
        });
    }

    if (errors.length) return { errors, parsed: p };

    // "blotka" oznacza dowolną z małych kart tej ręki — wszystkie są równoważne
    const cardsFor = (seat, spec) => (/blotk|^x$/i.test(spec)
        ? spotsOf[seat]
        : (spec.match(/10|[AKDW]|[2-9]/g) || []).map((t) => suit + toRank(t)));

    const hand = hands[p.defender];
    const accepted = cardsFor(p.defender, p.answer);
    const unknown = accepted.filter((c) => !hand.includes(c));
    if (!accepted.length) errors.push(`nie rozpoznano kart w "Dobre: ${p.answer}"`);
    if (unknown.length) errors.push(`rozwiązanie wskazuje ${unknown.join(', ')}, czego nie ma w ręce ${p.defender}`);

    // "Wyszło: S:K, N:6" -> ["S:SK", "N:S6"]
    const history = [];
    if (p.lead) {
        const used = [];
        for (const [, seat, card] of p.lead.matchAll(/([NESW]):\s*(10|[AKDW]|[2-9]|x)/g)) {
            const candidates = cardsFor(seat, card).filter((c) => !used.includes(c));
            if (!hands[seat] || !candidates.length) {
                errors.push(`"Wyszło" wskazuje ${seat}:${card}, czego nie ma w tej ręce`);
                continue;
            }
            used.push(candidates[0]);
            history.push(`${seat}:${candidates[0]}`);
        }
    }
    if (errors.length) return { errors, parsed: p };

    const tree = {};
    // Opis trafia też na gałąź poprawną — gracz ma się dowiedzieć, DLACZEGO zagrał dobrze,
    // a nie tylko zobaczyć ekran sukcesu.
    for (const code of accepted) {
        tree[code] = { is_correct: true, next_user_move: null, message: p.explanation };
    }
    // Opcjonalne "Złe: 8 — komunikat" nadpisuje ogólny opis dla konkretnej karty
    for (const entry of p.wrong) {
        const [spec, ...rest] = entry.split(/\s+[—–-]\s+/);
        const msg = rest.join(' ').trim() || p.explanation;
        for (const code of cardsFor(p.defender, spec)) {
            if (!accepted.includes(code)) tree[code] = { is_correct: false, message: msg };
        }
    }
    tree.default = { is_correct: false, message: p.explanation };
    tree.hints = [`Obrona ma wziąć ${p.target} ${p.target === 1 ? 'lewę' : 'lewy'}.`];

    // Klucz liczony z treści zadania, nie z etykiety — numery w pliku bywają zduplikowane
    const importKey = crypto.createHash('sha1').update(JSON.stringify({
        hands, defender: p.defender, accepted: [...accepted].sort(), contract: p.contract, history,
    })).digest('hex').slice(0, 16);

    return {
        errors: [],
        parsed: p,
        row: {
            puzzle_type: TYPE,
            difficulty: p.difficulty || DIFFICULTY,
            contract: p.contract,
            declarer: p.declarer,
            is_active: false, // wchodzi jako szkic — włączasz po przejrzeniu
            solution_tree: {
                hands,
                history,
                turn: p.defender,
                contract: p.contract,
                declarer: p.declarer,
                defender: p.defender,
                target_tricks: p.target,
                source: p.label,
                import_key: importKey,
                solution_tree: tree,
            },
        },
    };
}

// ---------- główny przebieg ----------
(async () => {
    const blocks = parseBlocks(readSource(file));
    const parsed = blocks.map((b, i) => parseBlock(b, i + 1));
    const built = parsed.map(buildPuzzle);

    const ok = built.filter((b) => !b.errors.length);
    const bad = built.filter((b) => b.errors.length);

    console.log(`Wczytano bloków: ${blocks.length}`);
    console.log(`Gotowych do importu: ${ok.length}`);
    console.log(`Odrzuconych: ${bad.length}\n`);

    if (bad.length) {
        const grouped = {};
        for (const b of bad) for (const e of b.errors) (grouped[e] ||= []).push(b.parsed.label);
        console.log('Powody odrzucenia:');
        for (const [reason, labels] of Object.entries(grouped)) {
            const shown = labels.slice(0, 8).join(' ');
            console.log(`  ${labels.length}× ${reason}`);
            console.log(`      ${shown}${labels.length > 8 ? ' …' : ''}`);
        }
        console.log('');
    }

    let candidates = LIMIT ? ok.slice(0, LIMIT) : ok;

    // Odsiew powtórek wewnątrz samego pliku
    const seenInFile = new Set();
    const dupInFile = [];
    candidates = candidates.filter((b) => {
        const key = b.row.solution_tree.import_key;
        if (seenInFile.has(key)) { dupInFile.push(b.parsed.label); return false; }
        seenInFile.add(key);
        return true;
    });
    if (dupInFile.length) console.log(`Powtórki w pliku (pominięte): ${dupInFile.join(' ')}\n`);

    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    // Odsiew tego, co już jest w bazie
    const { data: existing, error: readError } = await supabase
        .from('puzzles').select('id, key:solution_tree->>import_key');
    if (readError) {
        console.error('Nie udało się sprawdzić istniejących zagadek:', readError.message);
        process.exit(1);
    }
    const inDb = new Map((existing || []).filter((r) => r.key).map((r) => [r.key, r.id]));
    const alreadyThere = candidates.filter((b) => inDb.has(b.row.solution_tree.import_key));
    const toInsert = candidates.filter((b) => !inDb.has(b.row.solution_tree.import_key));
    const toUpdate = UPDATE
        ? alreadyThere.map((b) => ({ id: inDb.get(b.row.solution_tree.import_key), b }))
        : [];

    if (alreadyThere.length) {
        const verb = UPDATE ? 'do aktualizacji' : 'pominięte, już w bazie';
        console.log(`Już w bazie (${verb}): ${alreadyThere.map((b) => b.parsed.label).join(' ')}\n`);
    }

    if (!COMMIT) {
        if (toInsert.length) {
            console.log('Przykład pierwszej nowej zagadki (dry-run):');
            console.log(JSON.stringify(toInsert[0].row, null, 2));
        }
        console.log(`\nDRY-RUN — nic nie zapisano. Do wstawienia: ${toInsert.length}.${UPDATE ? ` Do aktualizacji: ${toUpdate.length}.` : ''} Dodaj --commit.`);
        return;
    }

    if (!toInsert.length && !toUpdate.length) {
        console.log('Nic nowego do zapisania.');
        return;
    }

    if (toInsert.length) {
        const { data, error } = await supabase.from('puzzles').insert(toInsert.map((b) => b.row)).select('id');
        if (error) {
            console.error('Błąd zapisu:', error.message);
            process.exit(1);
        }
        console.log(`Zapisano ${data.length} nowych zagadek (is_active = false).`);
        console.log('Włącz je dopiero po przejrzeniu w aplikacji.');
    }

    if (toUpdate.length) {
        // is_active celowo nie wchodzi do update — poprawka treści nie ma cofać
        // zagadki, którą ktoś już przejrzał i włączył.
        for (const { id, b } of toUpdate) {
            const { puzzle_type, difficulty, contract, declarer, solution_tree } = b.row;
            const { error } = await supabase.from('puzzles')
                .update({ puzzle_type, difficulty, contract, declarer, solution_tree })
                .eq('id', id);
            if (error) {
                console.error(`Błąd aktualizacji (${b.parsed.label}):`, error.message);
                process.exit(1);
            }
        }
        console.log(`Zaktualizowano ${toUpdate.length} istniejących zagadek (is_active bez zmian).`);
    }
})();
