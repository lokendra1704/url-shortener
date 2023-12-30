Steps to Run:
- npm i
- npm run dev

CURL for Testiing:
- curl --location 'http://localhost:3000/shorten_url' \
--header 'Content-Type: application/x-www-form-urlencoded' \
--data-urlencode 'url=www.google.com'