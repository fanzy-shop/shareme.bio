# ShareMe.bio

A simple, elegant blogging platform inspired by Telegraph. ShareMe.bio allows users to create and publish beautiful articles with a clean, minimalist interface.

## Features

- **Clean Editor**: Distraction-free writing experience with real-time preview
- **Image Support**: Drag and drop or click to insert images directly in your posts
- **Mobile Responsive**: Optimized for both desktop and mobile devices
- **Authentication**: Telegram-based authentication system
- **Edit Tokens**: Secure editing with unique tokens for each post
- **Dashboard**: Manage all your posts in one place

## Tech Stack

- **Backend**: Node.js with Express
- **Frontend**: EJS templates with vanilla JavaScript
- **Database**: File-based storage with JSON
- **Authentication**: Telegram Bot API
- **Styling**: Custom CSS with mobile-first design

## Installation

1. Clone the repository:
```bash
git clone https://github.com/fanzy-shop/shareme.bio.git
cd shareme.bio
```

2. Install dependencies:
```bash
cd backend
npm install
```

3. Set up environment variables:
Create a `.env` file in the backend directory with:
```
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
SESSION_SECRET=your_session_secret
BASE_URL=https://your-domain.com
```

4. Start the server:
```bash
npm start
```

The application will be available at `http://localhost:8080`

## Deployment

### Railway
1. Connect your GitHub repository to Railway
2. Set the following environment variables:
   - `TELEGRAM_BOT_TOKEN`: Your Telegram bot token
   - `SESSION_SECRET`: A secure random string for session encryption
   - `BASE_URL`: Your Railway app URL (e.g., `https://your-app.railway.app`)
3. Deploy! Railway will automatically detect the Node.js app and use the `start` script.

### Other Platforms
The app is configured to work with any Node.js hosting platform:
- **Vercel**: Use the `start` script
- **Heroku**: Uses the `start` script automatically
- **DigitalOcean App Platform**: Configure as Node.js app
- **Google Cloud Run**: Use the provided Dockerfile or buildpack

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `TELEGRAM_BOT_TOKEN` | Your Telegram bot token for authentication | Yes |
| `SESSION_SECRET` | Secret key for session encryption | Yes |
| `BASE_URL` | Your application's base URL | Yes |
| `PORT` | Port to run the server on (default: 8080) | No |
| `NODE_ENV` | Environment (production/development) | No |

## Usage

1. **Creating Posts**: Visit the homepage and start writing
2. **Publishing**: Click "PUBLISH" to make your post live
3. **Editing**: Use the edit token or dashboard to modify posts
4. **Images**: Click the image icon on empty lines to insert images

## Project Structure

```
shareme/
├── backend/
│   ├── models/
│   ├── routes/
│   ├── utils/
│   ├── views/
│   ├── public/
│   └── app.js
└── README.md
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

This project is open source and available under the MIT License. 