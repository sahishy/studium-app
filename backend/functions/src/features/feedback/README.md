# Feedback

The sidebar feedback modal calls the authenticated `POST /v1/feedback` API. Each
submission creates a Discord Forum post with the description, the user's profile
name, and an optional image. Images are limited to 5 MB (PNG, JPG, WebP,
or GIF); descriptions are limited to 4,000 characters. Submissions are limited
to one successful submission per user per minute. Failed deliveries allow retries;
an in-flight submission blocks duplicate sends for up to 30 seconds.

The image section supports file selection or a screenshot of the visible page.
Taking a screenshot hides the feedback form and opens a small draggable capture
window. Capture attaches the image and restores the draft; Close restores the
draft without attaching anything. Screenshots are created in the browser and
sent to Discord only when the user submits their feedback.

Users must select Suggestion or Bug report. The API maps the category to its
existing Discord Forum tag using `applied_tags`:

- Suggestion: `1533505595943161896`
- Bug report: `1533505612179046581`

Set `DISCORD_FEEDBACK_WEBHOOK_URL` in `backend/functions/.env`. Firebase loads
this backend environment variable for emulators and deployed functions; the
feedback API reads it from `process.env`. Restart the Functions emulator after
changing `.env`. Keep the webhook out of frontend environment variables and
source constants.

For production, deploy the API with the backend `.env` configured:

```sh
firebase deploy --only functions:api
```

No other Discord credentials are needed. Both configured tag IDs must belong
to the Forum channel connected to the webhook.

Run the focused delivery and validation tests with:

```sh
node --test backend/functions/src/features/feedback/feedbackService.test.js
```
