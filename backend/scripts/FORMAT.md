# Format zagadek jednokolorowych

Opis tego, co czyta [`import-puzzles.js`](./import-puzzles.js). Plik może być `.docx`
albo `.txt` — importer sam wyciąga tekst z Worda.

## Szablon do skopiowania

```
1.
N: AD9xxx
E: W10x
S: Kx
W: xx

Kolor: ♦
Kontrakt: 3NT
Rozgrywający: S
Broniący: E
Lewy do wzięcia na obronie: 1
Wyszło: S:K, W:x, N:x
Dobre: W, 10
Złe: x — Zrzucając blotkę pozwalasz rozgrywającemu wyimpasować drugi honor.
Trudność: medium

Zrzucając honor (Waleta lub 10) dajemy rozgrywającemu szansę zagrania na impas
drugiego honoru.
```

Zadania oddzielasz linią z samym numerem i kropką (`1.`, `2.`, …). Numer służy
wyłącznie do orientacji — **nie jest identyfikatorem**, więc powtórzony numer niczego
nie psuje. Kolejność linii wewnątrz bloku jest dowolna.

## Pola

| Pole | Wymagane | Znaczenie |
|---|---|---|
| `N:` `E:` `S:` `W:` | **tak** | Ręce. Kolejność dowolna, ale musi być komplet czterech. |
| `Kontrakt:` | **tak** | `3NT`, `3BA`, `4♠`, `4♥`… (`BA` zamienia się na `NT`) |
| `Rozgrywający:` | **tak** | Pozycja rozgrywającego, zwykle `S` |
| `Lewy do wzięcia na obronie:` | **tak** | Liczba lew dla obrony |
| `Dobre:` *(albo `Rozwiązanie:`)* | **tak** | Poprawna karta lub karty broniącego |
| `Kolor:` | zalecane | Kolor zagadki — bez tego wszystko wejdzie jako piki |
| `Broniący:` | zalecane | Kto podejmuje decyzję. Domyślnie **druga wymieniona pozycja** |
| `Wyszło:` | zalecane | Karty leżące już na stole, w kolejności zagrania |
| `Złe:` | nie | Osobny komunikat dla konkretnej błędnej karty. Można powtarzać |
| `Trudność:` | nie | `easy`, `medium`, `hard`. Domyślnie `medium` |

Każda linia, która nie pasuje do żadnego z powyższych wzorców, trafia do **opisu** —
tekstu pokazywanego graczowi po zakończeniu zagadki.

## Zapis kart

Polskie oznaczenia, zamieniane przy imporcie na angielskie w bazie:

| Piszesz | W bazie | |
|---|---|---|
| `A` | `A` | As |
| `K` | `K` | Król |
| `D` | `Q` | **D**ama |
| `W` | `J` | **W**alet |
| `10` … `2` | bez zmian | blotki nazwane |
| `x` | dowolna wolna | blotka nieistotna |

`x` oznacza kartę, której konkretna wartość nie ma znaczenia. Importer rozdziela wolne
rangi malejąco. Przykład: `AD9xxx` to A, D, 9 i trzy dowolne blotki.

## Kolor

Reguła: **przy kontrakcie w kolor rozpatrywany kolor jest kolorem atutowym.** Przy bez
atu nic go nie wyznacza — wybierasz dowolny.

Akceptowane zapisy: `♠ ♥ ♦ ♣`, `S H D C`, `pik piki kier kiery karo kara trefl trefle`.

Pole jest opcjonalne, ale **nie zostawiaj go pustego przy kontraktach kolorowych** —
domyślne piki przy kontrakcie 4♥ zrobią z koloru bocznego atu.

## `Wyszło:` — pozycja wyjściowa

Pary `pozycja:karta`, oddzielone przecinkami, **w kolejności zagrania**:

```
Wyszło: S:K, W:x, N:x
```

Kolejność jest zgodna z ruchem wskazówek zegara: N → E → S → W → N. Jeśli wychodzi S,
dokładają kolejno W, N, E.

Bez tego pola gracz zobaczy pusty stół. Przy zadaniach zaczynających się w środku lewy
(*„pokryjemy zagraną figurę"*, *„po zagraniu przez nas 8-ki"*) to pole jest konieczne,
żeby zagadka miała sens.

## `Dobre:` — poprawna odpowiedź

Trzy formy:

```
Dobre: 10             jedna karta
Dobre: W, 10          kilka równoważnych
Dobre: blotka         każda blotka broniącego
```

To jedyne pole, którego nie da się wywnioskować z opisu automatycznie. Bez niego
zadanie zostanie odrzucone.

## Co parser sprawdza

Blok zostaje odrzucony (z podaniem powodu), gdy:

- brakuje którejś z czterech rąk, kontraktu, rozgrywającego lub `Dobre:`
- ręce nie sumują się do **13 kart**
- ta sama figura występuje dwa razy
- liczba `x` nie zgadza się z liczbą wolnych rang
- karta z `Dobre:` nie leży w ręce broniącego
- `Wyszło:` wskazuje kartę, której nie ma w danej ręce

Odrzucenie jednego bloku nie blokuje pozostałych — importer wypisze zbiorczy raport.

## Import

```bash
node scripts/import-puzzles.js "Kolory do apki.docx"            # próba na sucho
node scripts/import-puzzles.js "Kolory do apki.docx" --commit    # zapis do bazy
```

Opcje: `--type puzzle|defense` · `--difficulty easy|medium|hard` · `--suit S|H|D|C`
(gdy w pliku nie ma `Kolor:`) · `--limit N`

Wszystko wchodzi jako `is_active: false` — zagadki włączasz dopiero po obejrzeniu
w aplikacji.

### Deduplikacja

Klucz liczony z treści zadania (ręce, broniący, poprawne karty, kontrakt, historia),
nie z numeru. Ponowny import tego samego pliku nic nie dopisze.

**Uwaga:** z tego samego powodu import **nie aktualizuje** zagadek już wgranych. Jeśli
poprawisz opis albo `Dobre:` w zadaniu, które jest już w bazie, ponowny import je
pominie — trzeba je najpierw skasować.

## Częste potknięcia

**Zduplikowany numer bloku.** Nic nie psuje przy imporcie, ale utrudnia rozmowę o
konkretnym zadaniu. Warto numerować po kolei.

**Opis skopiowany z sąsiedniego zadania.** Przy tworzeniu wariantów lustrzanych
(zamiana K↔D lub W↔10) łatwo zapomnieć o zamianie figur w tekście. Opis zacznie wtedy
mówić o karcie, której broniący nie ma.

**Decyzja w drugiej lewie.** Format opisuje zagadki jednodecyzyjne — broniący kładzie
jedną kartę i koniec. Jeśli sens zadania polega na przepuszczeniu pierwszej lewy
i zagraniu dopiero w drugiej, trzeba całą pierwszą lewę wpisać w `Wyszło:`.

**Kto podejmuje decyzję.** Domyślnie druga wymieniona pozycja. Jeśli wypisujesz ręce
w innej kolejności, dodaj jawne `Broniący:`.
