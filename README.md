# Douban & WeRead Backup

Three browser-console scripts for exporting your movie and book records to CSV. Use them to keep a local backup or prepare data for services such as Letterboxd and Goodreads.

These are standalone scripts, not a browser extension or Node.js application. No installation, build step, or API key is required.

## Scripts

| Script | Source | Output |
| --- | --- | --- |
| [Douban movie exporter](./douban-movie-export-letterboxd-imdb-script.js) | Douban watched movies (`/collect`) | Letterboxd-style CSV and a separate IMDb-oriented CSV |
| [Douban book exporter](./douban-book-export-script.js) | Douban read books (`/collect`) or wanted books (`/wish`) | Goodreads-style CSV |
| [WeRead book exporter](./weread-book-sync-script.js) | Finished books on your WeRead shelf | Goodreads-style CSV with a `weread` bookshelf |

## Quick start

1. Use a modern desktop browser and sign in to the source service.
2. Open the appropriate page:
   - Movies: `https://movie.douban.com/people/YOUR_ID/collect`
   - Read books: `https://book.douban.com/people/YOUR_ID/collect`
   - Wanted books: `https://book.douban.com/people/YOUR_ID/wish`
   - WeRead: open your bookshelf at <https://weread.qq.com/>.
3. Open Developer Tools and select **Console**.
4. Open the matching script linked above and copy its entire contents. For Douban exports, adjust the batch settings described below before running.
5. Review the code, paste it into the console, and execute it. The script starts immediately.
6. Keep the page open until the export finishes. Progress and warnings appear in the console; completed CSV files download automatically.

Run each script on its own source website, not in a local file or on the destination service. The Douban scripts check the page path but do not verify the hostname or account ownership.

> Browser consoles may warn against pasting code. Only execute code you have reviewed and trust; do not bypass a warning for unfamiliar code.

## Douban movie export

Open your **watched movies** page and run [the movie script](./douban-movie-export-letterboxd-imdb-script.js).

### Batch settings

The current settings at the top of the script are:

```js
const START_INDEX = 0;
const MAX_COUNT = 75;
```

`START_INDEX` is a zero-based list offset; `MAX_COUNT` is the maximum number of movies to export in this run. The list is requested in `sort=time` order, with pagination advancing by 15 items.

### Output and field mapping

| File | CSV columns |
| --- | --- |
| `letterboxd_part_<START_INDEX>_<YYYY-MM-DD>.csv` | `imdbID`, `Title`, `Year`, `Rating`, `WatchedDate`, `Review` |
| `imdb_part_<START_INDEX>_<YYYY-MM-DD>.csv` | `Const`, `Your Rating`, `Date Rated`, `Title` |

- IMDb IDs are fetched from each movie's Douban detail page.
- When the displayed title contains `/`, the second segment is used; otherwise the first segment is used.
- The year is extracted only when the list item's description starts with a four-digit year.
- Letterboxd ratings retain Douban's 1–5 scale. IMDb ratings are doubled to a 2–10 scale.
- Dates and short comments come from the watched-movies list.
- Every processed movie appears in the Letterboxd CSV, even without an IMDb ID. **Only movies with an IMDb ID appear in the IMDb CSV.**
- Both files are UTF-8 with a byte-order mark (BOM).

The Letterboxd file is intended for its CSV importer. The IMDb-oriented file is a backup/preparation format, not a guarantee that IMDb supports importing it directly. Check the destination's current import requirements and review unmatched titles.

## Douban book export

Open your **read books** or **wanted books** page and run [the book script](./douban-book-export-script.js). The script selects `read` or `to-read` from the page path. Currently-reading books (`/do`) are not supported.

### Batch settings

**The committed script starts at offset 300, not at the beginning:**

```js
const START_INDEX = 300;
const MAX_COUNT = 100;
```

Set `START_INDEX` to `0` before your first full export. As with movies, this is a zero-based offset, and `MAX_COUNT` limits the current run.

The downloaded filename is:

```text
goodreads_exact_<read|to-read>_<START_INDEX>_<YYYY-MM-DD>.csv
```

The export includes titles, authors, ISBNs fetched from detail pages, personal ratings, list dates, shelf status, and short comments. For read books, the list date fills both `Date Read` and `Date Added`; for wanted books, only `Date Added` is filled.

## WeRead finished-book export

Sign in, open your bookshelf, and run [the WeRead script](./weread-book-sync-script.js).

Despite its filename, this script **exports data only**: it does not synchronize accounts or write to Goodreads.

- Reads the shelf endpoint using your existing browser login.
- Includes books where `finishReading === 1` or the associated progress is exactly `100`.
- Fetches book details when the shelf record lacks an ISBN, potentially filling missing publisher and publication-year fields too.
- Requests personal reviews and uses the first returned review.
- Maps supported recommendation values to stars: good/recommend → `5`, fair/average → `3`, bad/poor → `1`. Numeric values `1`, `2`, and `3` also follow that recommendation mapping; they are not treated as literal star ratings.
- Uses `readUpdateTime`, falling back to the progress update time, for both `Date Read` and `Date Added`. These are update timestamps, not necessarily exact completion or shelf-addition dates.
- Sets `Shelves` to `read` and `Bookshelves` to `weread`.

The script exports all qualifying books returned by the shelf endpoint; there are no batch controls. Books no longer present on that shelf are not included.

Output: `weread_complete_goodreads_<YYYY-MM-DD>.csv`.

## Goodreads CSV fields

Both book exporters use these 14 columns, in this order:

```text
Title, Author, ISBN, My Rating, Average Rating, Publisher, Binding,
Year Published, Original Publication Year, Date Read, Date Added,
Shelves, Bookshelves, My Review
```

The Douban exporter leaves `Average Rating`, `Publisher`, `Binding`, both publication-year fields, and `Bookshelves` empty. WeRead leaves `Average Rating` and `Binding` empty, and uses the same publication year for both year fields when available.

Book CSVs are UTF-8 without a BOM. All three scripts quote every CSV cell and escape embedded double quotes. Missing metadata is generally left blank.

For Goodreads, use its library import/export interface, check its current requirements, and verify book editions, shelves, ratings, and dates after importing. ISBN availability and destination matching can affect results.

## Saving partial exports and continuing batches

Both **Douban** scripts expose this console command while running:

```js
downloadNow()
```

It downloads the records collected so far. It **does not stop the running script**. The movie script downloads two files, 500 ms apart; allow multiple downloads if your browser prompts.

To continue a Douban export, start a new run with:

```text
next START_INDEX = previous START_INDEX + number of records actually exported
```

For movies, use the Letterboxd CSV's data-row count, not the IMDb CSV's count. Exclude the header when counting. Stop the old run or reload the page before starting another; both Douban scripts reuse the same global `downloadNow` function.

When combining batches, retain only one header row and check for duplicate or missing records. Changing your Douban list between runs can shift offsets.

WeRead does not provide `downloadNow()` or a resume mechanism; its download occurs after the loop finishes.

## Limitations and troubleshooting

- **Rate limits and verification:** Douban detail requests normally pause for 1.2–2 seconds, with an additional 1.5-second pause between list pages. WeRead normally pauses for 800 ms per processed book. These delays do not guarantee avoidance of rate limits.
- **Douban verification detection:** Both Douban scripts use a simple detail-page text check and attempt to save partial data when it matches. This can miss verification pages or stop on an unrelated match. An empty parsed list is treated as the end of the list, even if the response was a login or error page.
- **Missing metadata:** Detail-request failures can produce incomplete rows. Check console warnings and inspect the exported files.
- **Unexpected errors:** There is no general retry mechanism or HTTP-status validation. Initial shelf requests and Douban list requests can terminate a run on failure.
- **No download:** Check the browser's download permissions. For Douban, try `downloadNow()` while the current page is still open.
- **Empty export:** Confirm the account and source page. For Douban books, check that `START_INDEX` is not still `300`; for WeRead, confirm finished books remain on the shelf.
- **Broken characters in a spreadsheet:** Import the CSV explicitly as UTF-8. Treat ISBNs and IDs as text to avoid unwanted conversion.
- **Website changes:** The scripts depend on Douban HTML selectors and WeRead web endpoints. Changes to either service may require script updates.

Use conservative batches, respect each service's terms and limits, and complete verification normally rather than attempting to bypass it.

## Privacy and safety

The scripts use your current browser session to read source records and create local downloads. They do not upload CSVs to Letterboxd, IMDb, Goodreads, or another backup server.

Exports can contain personal ratings, reading/watching dates, and reviews. Store and share them accordingly. CSV quoting does not neutralize spreadsheet formulas: treat exported text as untrusted and avoid evaluating formula-like cells when opening files in spreadsheet software.
