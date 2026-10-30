LOCAL PREVIEW

Run `node scripts/local-preview.mjs`, then open http://127.0.0.1:4173.
This project preview server serves /support, /support/, and /support/index.html as
the Support page and never exposes directory listings.

STUMBL ABOUT PAGE - INSTALLATION

1. Upload about.html and about.css to the root of your GitHub repository,
   alongside index.html, styles.css, and script.js.

2. Upload assets/chad-richards.jpg into your existing assets folder.

3. In the navigation inside index.html, add this link before the Beta link:

   <a href="about.html">About Chad</a>

4. Commit the files to the main branch. Vercel should deploy the update
   automatically. The new page will be available at:

   https://stumblevents.com/about.html

EXPECTED GITHUB LAYOUT

api/
  subscribe.js
assets/
  bg-calendar-light.png
  bg-create-light.png
  bg-home-light.png
  bg-profile-light.png
  chad-richards.jpg       <-- new
  icon.png
  splash-day.png
  splash-night.png
about.css                 <-- new
about.html                <-- new
index.html                <-- add the About Chad navigation link
script.js
styles.css
