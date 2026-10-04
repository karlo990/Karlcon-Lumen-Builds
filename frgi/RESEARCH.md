# frgi: research basis

How Pinterest finds and ranks pins, what the site's pages contain, and what that means for curating Zimbabwe wildlife videos for Instagram.

## 1. How Pinterest's recommender works (and how to steer it)

| Paper | What it shows | What frgi does with it |
|---|---|---|
| Eksombatchai et al., **Pixie: A System for Recommending 3+ Billion Items to 200+ Million Users in Real-Time**, WWW 2018. [arXiv:1711.07601](https://arxiv.org/abs/1711.07601) | Recommendations come from short random walks with restart over the pin–board graph. Walks are biased toward neighbours that match the user, and visit counts rank the candidates. | `frgi next` runs the same kind of biased walk over the lead graph you build while browsing (landed pin → pins Pinterest showed beside it). Restarts are drawn from your relevant opened pins, and the most-visited unopened video pins are the leads to open next. |
| Liu et al., **Related Pins at Pinterest: The Evolution of a Real-World Recommender System**, WWW 2017. [arXiv:1702.07969](https://arxiv.org/abs/1702.07969) | The "More to explore" pins under a closeup come from board co-occurrence (pins people save together) and are re-ranked by engagement. | The pins shown next to a pin you landed on are strong leads, so the grabber records them as graph edges. Saving good finds to one focused board adds the co-occurrence signal that feeds Related Pins. |
| Ying et al., **Graph Convolutional Neural Networks for Web-Scale Recommender Systems** (PinSage), KDD 2018. [arXiv:1806.01973](https://arxiv.org/abs/1806.01973) | Pin embeddings combine the image, the text and the graph neighbourhood, and random-walk visit counts decide which neighbours matter. | frgi's score uses the same kinds of signal you can see: title, description, alt text and creator, plus lead strength from the walk. |
| Pal et al., **PinnerSage: Multi-Modal User Embedding Framework for Recommendations at Pinterest**, KDD 2020. [arXiv:2007.03634](https://arxiv.org/abs/2007.03634) | Each user is represented by several embeddings, one per cluster of interests, and recommendations are drawn from each cluster. | Use a dedicated Pinterest account (or at least a dedicated session) for curation, so "Zimbabwe safari video" becomes a dominant cluster instead of one interest among many. |
| Pancha et al., **PinnerFormer: Sequence Modeling for User Representation at Pinterest**, KDD 2022. [arXiv:2205.04507](https://arxiv.org/abs/2205.04507) | A transformer over the user's long action sequence predicts their engagement over the following days. | Steering is cumulative: days of consistent saves and closeups on Zimbabwe wildlife reshape the home feed, not just one session. |
| Xia et al., **TransAct: Transformer-based Realtime User Action Model for Recommendation at Pinterest**, KDD 2023. [arXiv:2306.00248](https://arxiv.org/abs/2306.00248) | The Homefeed ranker reacts to the user's most recent actions in real time. | Within a session, open and save on-target pins and skip off-target ones (e.g. Serengeti) without clicking them. The next scroll changes immediately. |
| Jing et al., **Visual Search at Pinterest**, KDD 2015. [arXiv:1505.07647](https://arxiv.org/abs/1505.07647) | Visual embeddings power "visually similar" results. | The Lens/visual-search button on a strong frame (an elephant at Nyamandhlovu Pan, say) is a second lead source that ignores weak captions. |
| Baltescu et al., **ItemSage: Learning Product Embeddings for Shopping Recommendations at Pinterest**, KDD 2022. [arXiv:2205.11728](https://arxiv.org/abs/2205.11728) | Unified image+text embeddings are shared across surfaces. | Text matters as well as pictures, which is why place names in titles and descriptions are weighted heavily. |

**The navigation loop.** Pinterest's own recommender does the crawling inside your browser, and frgi only reads what you saw. In practice:

1. Search a Zimbabwe term (`frgi keywords`).
2. Open the best video pin, which is where you "land".
3. The grabber records its "More to explore" leads.
4. `frgi next` says which of those leads to open next.
5. Save the good ones to one board, which steers Related Pins and Homefeed toward Zimbabwe safari video.

## 2. What Pinterest pages contain (checked October 2026)

- **Pin closeup pages are server-rendered.** They contain `<script type="application/ld+json">` blocks: a `SocialMediaPosting` (author, headline, `articleBody` with the auto alt text and description) and, for videos, a `VideoObject` (`uploadDate`, `thumbnailUrl`, captions `.vtt`). They also carry `__PWS_DATA__`, `__PWS_INITIAL_PROPS__` and direct video links: `v1.pinimg.com/videos/iht/expMp4/…_720w.mp4` and an HLS `.m3u8`.
- **"More to explore", search and home feeds are client-rendered.** Fetched without a browser, a search page contains no pins at all. Grid cards are `<a href="/pin/<id>/">` anchors with an `aria-label` and an `<img alt>`, and video cards show a duration badge (`0:31`).
- **The grid is virtualised.** Cards that scroll off-screen are removed from the DOM, so the grabber records each card as it mounts (MutationObserver) instead of scraping at the end.
- **robots.txt is `User-agent: * / Disallow: /`** on www.pinterest.com and the pinimg CDNs. Only listed bots are allowed, and Pinterest asks bot operators to apply through its [bot submission form](https://help.pinterest.com/bot-submission-form). An autonomous crawler would ignore that rule, so frgi doesn't crawl. Discovery happens in your browser, the only server call is Pinterest's public **oEmbed** endpoint (for pins you add by hand), and a video file is downloaded only after you've recorded permission for that pin.

## 3. Instagram: rights, captions, publishing

- **Permission first.** A Pinterest pin is usually somebody else's footage, and reposting it without permission infringes their copyright and breaks Instagram's and Pinterest's terms, which risks the account. frgi enforces this: `fetch`, `attach` and `publish` only work for pins marked `own`, `permission` or `licensed`, with a note saying who granted it. `frgi ask` drafts the request, and asking for the original file usually gets better quality than Pinterest's 720p re-encode (`frgi attach`).
- **Captions.** Tourism research treats Instagram as a co-creation space for destination image: what visitors post becomes the destination's perceived image ([Instagram as a Co-Creation Space for Tourist Destination Image-Building: Algarve and Costa del Sol](https://riuma.uma.es/entities/publication/48e790b5-5987-484c-9b08-93d5ccc05679/full)). Comparing photos posted by tourists with those posted by tourism organisations shows that place-specific subjects, wildlife and landscape, carry the image ([Destination image of Chitwan National Park, Nepal](https://research-repository.griffith.edu.au/items/18eb9b6c-5dc7-4844-b9a9-9adf368a1383)). A netnographic study of Instagram posts after wildlife-attraction visits reads captions for the strength of the visitor's connection to wildlife and conservation ([Frontiers in Sustainable Tourism, 2023](https://www.frontiersin.org/journals/sustainable-tourism/articles/10.3389/frsut.2023.1090749/pdf)). So each draft leads with species + experience + named place, names the park (`location_tag`), invites a comment, and credits the creator. Hashtags are place-first and capped well under Instagram's 30, with the caption checked against the 2,200-character limit.
- **Publishing** uses the [Instagram Graph API content publishing flow](https://developers.facebook.com/docs/instagram-platform/content-publishing): `POST /{ig-user-id}/media` with `media_type=REELS` and `video_url`, poll the container's `status_code` until `FINISHED`, then `POST /{ig-user-id}/media_publish`. This needs an Instagram professional account, a token, and the MP4 at a public HTTPS URL.

## 4. Zimbabwe gazetteer

`zimbabwe_keywords.json` lists:

- **Places.** The 11 ZimParks national parks (Hwange, Mana Pools, Gonarezhou, Victoria Falls, Zambezi, Matobo, Matusadona, Chizarira, Kazuma Pan, Nyanga, Chimanimani) plus Lake Kariba, Great Zimbabwe and the private conservancies (Save Valley, Malilangwe, Bubye Valley, Imire). Each has camp, landmark and local-name aliases, such as Mosi-oa-Tunya, Chilojo Cliffs, Nyamandhlovu Pan and Matopos. Source: [ZimParks overview](https://en.wikipedia.org/wiki/Zimbabwe_Parks_and_Wildlife_Management_Authority), [Rhino Africa: Zimbabwe's top national parks](https://blog.rhinoafrica.com/2026/03/24/zimbabwes-top-national-parks/).
- **Species.** Includes Shona/Ndebele names such as nzou/indlovu (elephant), shumba (lion) and mhumhi (painted dog).
- **Experiences.** Each one has a caption phrase.
- **An off-target list.** Pins from other countries are pushed out of the ranking unless they also name a Zimbabwe place. For example, the Murchison Falls pin in the screenshots is in Uganda.
