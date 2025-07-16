# ShareMe - Telegraph Clone

A simple publishing platform inspired by [Telegraph](https://telegra.ph), built with Node.js, Express, EJS, and Redis.

## Features

- Create and edit text posts with a clean, minimal interface
- No account system - each page has its own edit token
- Posts are stored in Redis
- Responsive design that works on mobile and desktop

## Setup

1. Clone the repository
2. Install dependencies:
```
cd backend
npm install
```

3. Start the server:
```
npm run dev
```

4. Open [http://localhost:8080](http://localhost:8080) in your browser

## How it works

- Create a post by entering a title and content, then click "Publish"
- You'll be redirected to an edit URL that includes your unique edit token
- Share the URL without the edit token for others to view your post
- Return to the edit URL anytime to make changes

## Technologies used

- Node.js
- Express
- EJS templates
- Redis database
- Modern ES modules 