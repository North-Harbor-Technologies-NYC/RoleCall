# Career-site scrub notes

Working methods per company, learned from live runs. The intake skill reads this before scrubbing. Update when a method stops working.

| Company | Method that works | Posted dates | Notes (2026-10-07) |
|---|---|---|---|
| Disney | `https://www.disneycareers.com/en/search-jobs` renders server side; `jobs.disneycareers.com` redirects there. Query by keyword; the location filter is ignored, so read locations from results. | Yes | Loose keyword match, noisy but readable. |
| NBCUniversal | `https://careers.smartrecruiters.com/NBCUniversal3` (SmartRecruiters) renders; `nbcunicareers.com` is JS-only. | No | Query by title words plus New York. |
| Netflix | JSON endpoint `https://explore.jobs.netflix.net/api/apply/v2/jobs` (Eightfold) with a query parameter; the HTML site is JS-rendered. | Yes (creation date) | Paginate; most in-scope roles are LA or Los Gatos. |
| Paramount | `https://careers.paramount.com/search/?q=` renders server side. Only the first 25 rows per query are visible; use several narrow queries. | Yes | careers.paramount.com also hosts Pluto TV and Paramount+ roles. |
| Amazon MGM Studios / Prime Video | `https://amazon.jobs/en/search.json` with query and location parameters; HTML search is JS-rendered. | Yes | Filter on "Amazon MGM Studios" or "Prime Video" in team or title. |
| Warner Bros. Discovery | `careers.wbd.com` is client-side rendered; search and category pages return empty templates to fetch tools. Needs a real browser session, or watch the Lensa and LinkedIn feeds which do carry WBD postings. | Unknown | Titles seen on aggregators 2026-10-07 and not yet verified: Senior Director Live Broadcast Operations; Director Production Operations; Director Localization Operations; Director Post Production Technical Operations, Localization; VP Global Content Management, Pipeline Planning; VP Studio Business Operations & Strategy, WB Animation. |

Companies on Ashby, Greenhouse, or Lever are covered by `portals/boards.mjs` and do not need a scrub: Runway, ElevenLabs, Luma AI, Synthesia, Stability AI, Perplexity AI, Axios, The Athletic, Descript, Morning Brew (Lever, `jobs.lever.co/morningbrew`, add to portals.yml).

Remaining `portals.yml` companies with no known method yet: Hulu (inside Disney search), Apple TV+, Peacock (inside NBCU), Spotify, A24, Anonymous Content, Imagine, Deloitte Digital, Accenture Song, WPP/Hogarth, Publicis, MediaLink, Brightcove, Kaltura, Avid, Frame.io, Iconik, Backlight, Captions, Opus Clip, Wondershare, Tavus, Google/YouTube, DeepMind, Twitch, Meta, Meta Reality Labs, the sports leagues, ESPN, TNT Sports, NBC Sports, Apple Sports. Work through these a few per day in the scrub and record what works here.

## Added 2026-10-08: 35 media, publisher, sports, and streamer companies

Each entry in `portals/portals.yml` now carries an `ats` field. Generic methods by ATS, verified on 2026-10-08:

| ATS | How to read it | Companies |
|---|---|---|
| Greenhouse, Lever, Ashby | `portals/boards.mjs`, zero tokens | Vox Media, NYT, Complex (Lever slug is case-sensitive: `Complex`), Barstool, Tubi (`tubitv`), Roku, Fubo (`fubotv`), Crunchyroll, Penske (`pmc`), Bustle (`BDG`) |
| Workday | `https://<tenant>.myworkdayjobs.com/<site>` renders server side with a search box; the JSON endpoint `<tenant>.myworkdayjobs.com/wday/cxs/<tenant>/<site>/jobs` (POST with `{"searchText":"...","limit":20,"offset":0}`) returns listings with posted dates | Conde Nast, iHeartMedia, WWE/TKO, Dotdash Meredith (People Inc.), AMC Networks, Warner Music Group, TelevisaUnivision, Scripps, Nexstar |
| SmartRecruiters | `https://api.smartrecruiters.com/v1/companies/<company>/postings?q=` | NBCUniversal (`NBCUniversal3`), Versant Media (`Versant3`) |
| iCIMS | `careers-<co>.icims.com/jobs/search?ss=1&searchKeyword=` | Audacy, MLS; SiriusXM uses a Jibe front end at `careers.siriusxm.com/api/jobs` |
| SAP SuccessFactors | `jobs.<co>.com/search/?q=` renders server side | Paramount, Lionsgate |
| Avature | `<co>.avature.net/careers/SearchJobs` | Bloomberg LP |
| Phenom | `careers.nba.com/search-results` (JS; try the headless browser) | NBA |
| Oracle HCM | `.../hcmUI/CandidateExperience/en/sites/<site>` (JS; headless) | Sinclair, Jefferies |
| UKG Pro | `recruiting.ultipro.com/<id>/JobBoard/<guid>/` (JS; headless) | Gray Media |
| Custom | foxcareers.com (Fox Corporation), msgentertainment.com/jobs (MSG; sister Greenhouse boards `msgsports`, `sphereentertainment`), disneycareers.com/lucasfilm-ilm-jobs (ILM), apply.workable.com/hello-sunshine (Hello Sunshine), amazon.jobs search for Wondery | as named |

Traps: Greenhouse slug `fox` is a veterinary hospital; Greenhouse slug `hearst` is a UAT sandbox (Hearst's real site, careers.hearst.com, refuses connections from the cloud environment); Lever slugs are case-sensitive. YES Network and Vice Media have no careers page and are disabled.
