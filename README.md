# Source Frames!

This is a template for a react router app using hash router to build to html files only with no backend needed. You can add a customizable array of frames going to different URLS or doing different things.

## Notes

- It is recommended to use Cloudflare Pages, Vercel, or Netlify instead of github pages because this project uses React Router's framework mode
- The Check-Lint-Format workflow builds as well as lints which could increase github actions spending. You can remove the build step if you care about CI/CD times or github actions budget.
- The Check-Lint-Format workflow does not fail fast. This works well for smaller repos, where you can get everything you need to change all at once, but could get costly for larger repos.
