# Claude Code Notes for SoluPresenter

## Deployment

**DO NOT deploy to Elastic Beanstalk (eb deploy).**

This project uses automatic deployment from GitHub to Render.com. When the user asks to deploy:

1. Commit the changes: `git commit`
2. Push to GitHub: `git push origin main`

That's it! Render.com will automatically pick up the changes from GitHub.
