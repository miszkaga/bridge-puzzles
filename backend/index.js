require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();

/**
 * Aplikacja natywna nie wysyła Origin i CORS jej nie dotyczy — ta lista jest wyłącznie
 * dla przeglądarki: web (Vite, 5173) i podgląd Expo w przeglądarce (8081).
 * Żądania bez Origin (curl, natywny fetch) przepuszczamy.
 */
const ALLOWED_ORIGINS = (process.env.CORS_ORIGIN || 'http://localhost:5173,http://localhost:8081')
    .split(',').map((s) => s.trim());

app.use(cors({
    origin(origin, cb) {
        if (!origin) return cb(null, true);
        // W sieci lokalnej host bywa adresem IP maszyny, nie "localhost"
        const ok = ALLOWED_ORIGINS.includes(origin) || /^http:\/\/(\d+\.){3}\d+:(5173|8081)$/.test(origin);
        // Odmowa to false, nie błąd — inaczej Express zamienia każde zapytanie z
        // nierozpoznanym originem w 500, nawet gdy request i tak jest same-origin
        // (przeglądarki bywają dołączają Origin poza właściwym CORS-em).
        cb(null, ok);
    },
}));
app.use(express.json());

// UWAGA: to jest klucz service_role — omija RLS. Wolno go trzymać wyłącznie
// po stronie serwera, nigdy pod prefiksem VITE_ ani w kodzie frontendu.
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const K_FACTOR = 32;

// Ile zadań wolno rozwiązać bez zakładania konta.
// 0 wyłącza ścianę — przydatne, dopóki nie ma jeszcze ekranu rejestracji.
const FREE_PUZZLE_LIMIT = Number(process.env.FREE_PUZZLE_LIMIT ?? 10);

// Ile rozwiązanych zagadek trzeba mieć za sobą, zanim Elo liczy się jako ranking,
// a nie jeszcze kalibracja (jak mecze rozstawiające w innych grach).
const RANKED_THRESHOLD = Number(process.env.RANKED_THRESHOLD ?? 10);

// Dziadek to zawsze partner rozgrywającego
const PARTNER = { N: 'S', S: 'N', E: 'W', W: 'E' };

// ==========================================
// Pamięć podręczna zagadek
// ==========================================
/**
 * Treść zagadek jest statyczna — zmienia się tylko przy imporcie albo włączeniu
 * zadania. Trzymanie jej w pamięci zdejmuje odpytywanie bazy z każdego ruchu
 * gracza, a to była większość czasu odpowiedzi.
 *
 * elo_rating i attempts zmieniają się przy rozliczeniach, więc do wyliczeń Elo
 * czytamy je zawsze świeżo z bazy — cache służy wyłącznie treści.
 */
const PUZZLE_CACHE_TTL = Number(process.env.PUZZLE_CACHE_TTL_MS ?? 60_000);
let puzzleCache = { loadedAt: 0, byId: new Map(), active: [] };

async function loadPuzzles() {
    if (Date.now() - puzzleCache.loadedAt < PUZZLE_CACHE_TTL && puzzleCache.byId.size) {
        return puzzleCache;
    }

    const { data, error } = await supabase
        .from('puzzles')
        .select('id, puzzle_type, difficulty, elo_rating, solution_tree, contract, declarer, is_active');
    if (error) throw error;

    puzzleCache = {
        loadedAt: Date.now(),
        byId: new Map(data.map((p) => [p.id, p])),
        active: data.filter((p) => p.is_active),
    };
    console.log(`Zagadki w pamięci: ${data.length} (aktywnych ${puzzleCache.active.length})`);
    return puzzleCache;
}

// Tryb z frontendu -> puzzle_type w bazie
const MODE_TO_TYPE = {
    puzzle: 'puzzle',
    problem: 'full_deal',
    daily: 'full_deal',
    play: 'declarer',
    declarer: 'declarer',
    defense: 'defense',
    bidding: 'bidding',
    'pair-bidding': 'bidding',
};

// ==========================================
// Przejście po drzewie rozwiązania (tylko na serwerze)
// ==========================================
// Nagłówek X-Lang z frontendu. Nieznana wartość schodzi do polskiego.
const readLang = (req) => (String(req.headers['x-lang'] || '').toLowerCase() === 'en' ? 'en' : 'pl');

// Zagadki bez tłumaczenia pokazują polski opis zamiast pustki
const pickMessage = (step, lang) => (lang === 'en' && step.message_en) || step.message;

function walkSolutionTree(root, movePath, lang = 'pl') {
    let node = root;
    let lastStep = null;

    for (const card of movePath) {
        const step = node[card] || node.default;
        if (!step) {
            return { is_correct: false, finished: true,
                message: lang === 'en' ? 'There is no defined answer for this card.' : 'Ten ruch nie ma zdefiniowanej odpowiedzi.' };
        }

        lastStep = step;
        if (!step.is_correct) break; // błędny ruch kończy zagadkę
        node = step.next_user_move || {};
    }

    if (!lastStep) {
        return { is_correct: false, finished: true,
            message: lang === 'en' ? 'No card was played.' : 'Nie zagrano żadnej karty.' };
    }

    // Koniec zagadki: albo błąd, albo poprawny ruch bez kontynuacji
    // (next_user_move bywa nieobecne albo jawnie ustawione na null)
    const finished = !lastStep.is_correct || lastStep.next_user_move == null;

    return {
        is_correct: !!lastStep.is_correct,
        finished,
        message: pickMessage(lastStep, lang),
        auto_reply: normalizeAutoReply(lastStep),
    };
}

// Odpowiedź przeciwnika może przyjść z dowolnej pozycji. Starsze zagadki mają
// auto_reply_W / auto_reply_E, nowe (obronne) odpowiadają z N albo S.
function normalizeAutoReply(step) {
    if (step.auto_reply && step.auto_reply.seat && step.auto_reply.card) {
        return { seat: step.auto_reply.seat, card: step.auto_reply.card };
    }
    for (const seat of ['N', 'E', 'S', 'W']) {
        const card = step[`auto_reply_${seat}`];
        if (card) return { seat, card };
    }
    return null;
}

// ==========================================
// Rozliczenie Elo — dokładnie raz na parę (gracz, zagadka)
// ==========================================
// ==========================================
// Rozpoznanie gracza
// ==========================================
/**
 * Token z Supabase Auth ma pierwszeństwo nad anonimowym identyfikatorem z
 * przeglądarki. Zwraca null, gdy nie da się ustalić, kto gra.
 *
 * Przy pierwszym logowaniu przejmujemy anonimowy profil z tej samej przeglądarki,
 * żeby postęp zrobiony przed rejestracją nie przepadł. Nie ruszamy przy tym klucza
 * głównego — wystarczy dopiąć auth_id, więc solved_puzzles zostaje na miejscu.
 */
async function resolvePlayer(req) {
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
    const anonId = req.body?.user_id || req.query?.user_id || null;

    if (!token) {
        return anonId ? { id: anonId, registered: false } : null;
    }

    const { data, error } = await supabase.auth.getUser(token);
    // Nieważny token to błąd, a nie powód, żeby po cichu potraktować kogoś jak gościa
    if (error || !data?.user) return null;
    const authUser = data.user;

    const { data: linked } = await supabase
        .from('users').select('id').eq('auth_id', authUser.id).maybeSingle();
    if (linked) return { id: linked.id, registered: true };

    if (anonId) {
        const { data: claimed } = await supabase
            .from('users')
            .update({ auth_id: authUser.id, email: authUser.email })
            .eq('id', anonId)
            .is('auth_id', null) // nie podbieramy cudzego, już powiązanego profilu
            .select('id')
            .maybeSingle();
        if (claimed) return { id: claimed.id, registered: true };
    }

    const { data: created, error: insertError } = await supabase
        .from('users').insert([{ auth_id: authUser.id, email: authUser.email }]).select('id').single();
    if (insertError) throw insertError;
    return { id: created.id, registered: true };
}

/** Identyfikatory zagadek rozwiązanych przez gracza. Jedno zapytanie obsługuje
 *  i ścianę rejestracji, i kolejkę nierozwiązanych — nie ma sensu pytać dwa razy. */
async function solvedPuzzleIds(userId) {
    if (!userId) return [];
    const { data, error } = await supabase
        .from('solved_puzzles').select('puzzle_id').eq('user_id', userId);
    if (error) throw error;
    return (data || []).map((s) => s.puzzle_id);
}

/** Ściana rejestracji. Zwraca opis blokady albo null, gdy można grać dalej. */
function registrationWall(player, solvedCount, lang = 'pl') {
    if (!FREE_PUZZLE_LIMIT || !player || player.registered) return null;
    if (solvedCount < FREE_PUZZLE_LIMIT) return null;

    return {
        error: 'registration_required',
        message: lang === 'en'
            ? `You've solved ${solvedCount} puzzles without an account. Create one to keep playing and keep your progress.`
            : `Rozwiązałeś ${solvedCount} zadań bez konta. Załóż je, żeby grać dalej i nie stracić postępu.`,
        solved: solvedCount,
        limit: FREE_PUZZLE_LIMIT,
    };
}

// Konta zakładają się same przy pierwszym rozliczeniu — identyfikator generuje
// przeglądarka i trzyma w localStorage. Bez tego solved_puzzles poleci na FK.
// Upsert zamiast select+insert: jedna runda zamiast dwóch.
async function ensureUser(user_id) {
    const { error } = await supabase
        .from('users')
        .upsert([{ id: user_id }], { onConflict: 'id', ignoreDuplicates: true });
    if (error && error.code !== '23505') throw error;
}

async function settlePuzzle({ user_id, puzzle_id, is_correct }) {
    await ensureUser(user_id);

    // UNIQUE (user_id, puzzle_id) działa jak bramka: jeśli wpis już istnieje,
    // wychodzimy PRZED dotknięciem Elo. Kolejność ma tu znaczenie.
    const { error: insertError } = await supabase
        .from('solved_puzzles')
        .insert([{ user_id, puzzle_id, solved_correctly: is_correct }]);

    if (insertError && insertError.code === '23505') return { already_played: true };
    if (insertError) throw insertError;

    // Trzy niezależne odczyty jedną rundą zamiast trzech po kolei
    const [{ data: user }, { data: puzzle }, { data: attemptRows }] = await Promise.all([
        supabase.from('users').select('elo_rating').eq('id', user_id).single(),
        supabase.from('puzzles').select('elo_rating').eq('id', puzzle_id).single(),
        supabase.from('solved_puzzles').select('solved_correctly').eq('puzzle_id', puzzle_id),
    ]);
    if (!user || !puzzle) throw new Error('Nie znaleziono gracza lub zagadki.');

    const expectedScore = 1 / (1 + Math.pow(10, (puzzle.elo_rating - user.elo_rating) / 400));
    const actualScore = is_correct ? 1 : 0;

    const newUserElo = Math.round(user.elo_rating + K_FACTOR * (actualScore - expectedScore));
    const newPuzzleElo = Math.round(puzzle.elo_rating + K_FACTOR * ((1 - actualScore) - (1 - expectedScore)));

    // attempts i success_rate liczymy z faktycznych, unikalnych podejść —
    // oba wychodzą z tej samej listy, więc drugie zapytanie jest zbędne
    const attempts = (attemptRows || []).length;
    const solved = (attemptRows || []).filter((r) => r.solved_correctly).length;

    await Promise.all([
        supabase.from('users').update({ elo_rating: newUserElo }).eq('id', user_id),
        supabase.from('puzzles').update({
            elo_rating: newPuzzleElo,
            attempts: attempts || 0,
            success_rate: attempts ? solved / attempts : 0,
        }).eq('id', puzzle_id),
    ]);

    return {
        old_elo: user.elo_rating,
        new_elo: newUserElo,
        elo_change: newUserElo - user.elo_rating,
    };
}

// ==========================================
// 1. ENDPOINT: Losowa zagadka (BEZ ODPOWIEDZI)
// ==========================================
app.get('/api/puzzles/random', async (req, res) => {
    try {
        const puzzleType = MODE_TO_TYPE[req.query.mode];

        const player = await resolvePlayer(req);

        // Lista zagadek idzie z pamięci, lista rozwiązanych z bazy — równolegle
        const [cache, solvedIds] = await Promise.all([
            loadPuzzles(),
            solvedPuzzleIds(player?.id),
        ]);

        const wall = registrationWall(player, solvedIds.length, readLang(req));
        if (wall) return res.status(403).json(wall);

        const available = puzzleType
            ? cache.active.filter((p) => p.puzzle_type === puzzleType)
            : cache.active;
        if (!available.length) return res.status(404).json({ error: readLang(req) === 'en' ? 'No puzzles available for this mode' : 'Brak dostępnych zagadek dla tego trybu' });

        // Najpierw to, czego gracz jeszcze nie rozwiązywał. Gdy wyczerpie pulę,
        // kolejka rusza od nowa — zagadki zostają grywalne, tylko bez zmian Elo.
        let pool = available;
        let replay = false;

        if (player) {
            const done = new Set(solvedIds);
            const untouched = pool.filter((p) => !done.has(p.id));
            if (untouched.length) pool = untouched;
            else replay = true;
        }

        const row = pool[Math.floor(Math.random() * pool.length)];
        const tree = row.solution_tree || {};
        // BEZPIECZEŃSTWO: drzewo odpowiedzi nie opuszcza serwera
        const { solution_tree: _answer, import_key: _key, hands: allHands, ...safeTree } = tree;

        const declarer = row.declarer || tree.declarer || 'S';
        const defender = tree.defender || null;
        const hero = defender || declarer;
        const dummy = PARTNER[declarer];

        // BEZPIECZEŃSTWO: gracz widzi tylko swoją rękę i dziadka. Przy zagadkach
        // obronnych ręka rozgrywającego JEST rozwiązaniem, więc nie może wyjść na klient.
        const played = (tree.history || []).map((e) => String(e).split(':')[1]);
        const hands = {};
        const handCounts = {};
        for (const [seat, cards] of Object.entries(allHands || {})) {
            const remaining = (cards || []).filter((c) => !played.includes(c));
            handCounts[seat] = remaining.length;
            if (seat === hero || seat === dummy) hands[seat] = cards;
        }

        res.json({
            id: row.id,
            puzzle_type: row.puzzle_type,
            difficulty: row.difficulty,
            elo_rating: row.elo_rating,
            // contract/declarer bywają w kolumnie albo w starszych zagadkach w JSON-ie
            contract: row.contract || tree.contract || null,
            declarer,
            // true = pula wyczerpana, gracz zaczyna drugie kółko (bez zmian Elo)
            replay,
            solution_tree: { ...safeTree, hands, hand_counts: handCounts, declarer, defender },
        });
    } catch (error) {
        console.error('Błąd pobierania zagadki:', error);
        res.status(500).json({ error: 'Wewnętrzny błąd serwera' });
    }
});

// ==========================================
// 2. ENDPOINT: Weryfikacja ruchu (BEZ rozliczenia)
// ==========================================
/**
 * Rozliczenie Elo (dwie rundy do Supabase) celowo nie siedzi tu już w środku —
 * przeniosło się do /api/puzzles/settle, którą klient odpala równolegle z
 * animacją odsłaniania rozdania, zamiast czekać na nią przed pokazaniem czegokolwiek.
 */
app.post('/api/puzzles/play', async (req, res) => {
    const { puzzle_id, move_path } = req.body;

    if (!puzzle_id || !Array.isArray(move_path) || move_path.length === 0) {
        return res.status(400).json({ error: 'Nieprawidłowe dane żądania' });
    }

    try {
        // O tym, kto gra, decyduje token — a nie to, co przyszło w ciele żądania
        const player = await resolvePlayer(req);

        // Ścianę trzeba sprawdzać tylko gościom — zalogowanych nie dotyczy,
        // więc oszczędzamy im całe zapytanie na każdym ruchu.
        const needsWallCheck = FREE_PUZZLE_LIMIT && player && !player.registered;
        const [cache, solvedIds] = await Promise.all([
            loadPuzzles(),
            needsWallCheck ? solvedPuzzleIds(player.id) : Promise.resolve([]),
        ]);

        const wall = registrationWall(player, solvedIds.length, readLang(req));
        if (wall) return res.status(403).json(wall);

        const puzzle = cache.byId.get(puzzle_id);
        if (!puzzle) return res.status(404).json({ error: readLang(req) === 'en' ? 'Puzzle not found' : 'Zagadka nie istnieje' });

        const outcome = walkSolutionTree(puzzle.solution_tree?.solution_tree || {}, move_path, readLang(req));

        const response = { is_correct: outcome.is_correct, finished: outcome.finished };
        if (outcome.message) response.message = outcome.message;
        if (outcome.auto_reply) response.auto_reply = outcome.auto_reply;

        // Zagadka skończona — można pokazać wszystkie ręce do obejrzenia rozdania
        if (outcome.finished) response.hands = puzzle.solution_tree?.hands || {};

        res.json(response);
    } catch (error) {
        console.error('Błąd weryfikacji ruchu:', error);
        res.status(500).json({ error: 'Wewnętrzny błąd serwera' });
    }
});

// ==========================================
// 3. ENDPOINT: Rozliczenie Elo — osobno, równolegle z animacją
// ==========================================
/**
 * Klient odpala to zaraz po tym, jak /play zwróci finished:true — w tym samym
 * momencie, w którym zaczyna się odtwarzać animację odsłaniania rozdania. Zanim
 * animacja się skończy, te dwie rundy do Supabase zwykle już zdążą wrócić, więc
 * gracz ich w ogóle nie czeka.
 *
 * O poprawności ruchu i tak decyduje serwer od nowa (walkSolutionTree z cache),
 * a nie to, co klient twierdzi że wygrał — is_correct nigdy nie przychodzi z ciała żądania.
 */
app.post('/api/puzzles/settle', async (req, res) => {
    const { puzzle_id, move_path } = req.body;

    if (!puzzle_id || !Array.isArray(move_path) || move_path.length === 0) {
        return res.status(400).json({ error: 'Nieprawidłowe dane żądania' });
    }

    try {
        const player = await resolvePlayer(req);
        if (!player) return res.json({ result: null, free_left: null });

        const cache = await loadPuzzles();
        const puzzle = cache.byId.get(puzzle_id);
        if (!puzzle) return res.status(404).json({ error: readLang(req) === 'en' ? 'Puzzle not found' : 'Zagadka nie istnieje' });

        const outcome = walkSolutionTree(puzzle.solution_tree?.solution_tree || {}, move_path, readLang(req));
        if (!outcome.finished) {
            return res.status(400).json({ error: readLang(req) === 'en' ? 'Puzzle is not finished yet' : 'Zagadka jeszcze nie skończona' });
        }

        const result = await settlePuzzle({ user_id: player.id, puzzle_id, is_correct: outcome.is_correct });

        let free_left = null;
        if (!player.registered && FREE_PUZZLE_LIMIT) {
            const solvedIds = await solvedPuzzleIds(player.id);
            free_left = Math.max(0, FREE_PUZZLE_LIMIT - solvedIds.length);
        }

        res.json({ result, free_left });
    } catch (error) {
        console.error('Błąd rozliczenia:', error);
        res.status(500).json({ error: 'Wewnętrzny błąd serwera' });
    }
});

// ==========================================
// 4. ENDPOINT: Stan gracza na stronę główną (Elo, kalibracja)
// ==========================================
app.get('/api/user/stats', async (req, res) => {
    try {
        const player = await resolvePlayer(req);
        if (!player) return res.json({ state: 'calibrating', elo: null, played: 0, total: RANKED_THRESHOLD });

        const [{ data: user }, solvedIds] = await Promise.all([
            supabase.from('users').select('elo_rating').eq('id', player.id).single(),
            solvedPuzzleIds(player.id),
        ]);

        const played = solvedIds.length;
        res.json({
            state: played >= RANKED_THRESHOLD ? 'ranked' : 'calibrating',
            elo: user?.elo_rating ?? null,
            played,
            total: RANKED_THRESHOLD,
        });
    } catch (error) {
        console.error('Błąd pobierania statystyk gracza:', error);
        res.status(500).json({ error: 'Wewnętrzny błąd serwera' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Serwer backendowy działa na porcie ${PORT}`);
});
