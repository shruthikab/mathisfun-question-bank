# MathQuest Question Bank

A web application for managing and practicing math questions with user authentication.

## Features

- **User Authentication**: Sign up and login to access the question bank
- **Role-based Access**: Student view (questions only) and Admin view (with hints and answers)
- **Question Management**: Filter by paper, category, and search
- **Practice Mode**: One-by-one question practice with timer
- **AI Import**: Import questions from uploaded files (requires OpenAI API key)

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Edit `.env`:
- `JWT_SECRET`: Change to a random secure string for production
- `OPENAI_API_KEY`: Add your OpenAI API key (optional, for AI import feature)

### 3. Start the Server

```bash
npm start
```

The server will start at `http://localhost:3000`

### 4. Create Your First Account

1. Open http://localhost:3000 in your browser
2. Click "Sign Up" tab
3. Enter your name, email, and password (min 6 characters)
4. Click "Create Account"

## Database

This app uses **SQLite** (file-based database) for simplicity:
- Database file: `mathisfun.db` (auto-created on first run)
- No server setup required!

### Database Trade-offs (for beginners)

| Database | Best For | Setup Complexity |
|----------|----------|------------------|
| **SQLite** (current) | Small apps, development, single-user | Easiest - just a file |
| **MongoDB** | Flexible schemas, JSON-like data | Medium - needs MongoDB server |
| **PostgreSQL** | Complex queries, data integrity, production | Medium - needs PostgreSQL server |

**Why SQLite?** Perfect for getting started quickly. To switch databases later, you'd only need to change the `db.js` file.

## Project Structure

```
mathisfun-question-bank/
├── api/
│   ├── auth.js        # Authentication API (login/signup)
│   └── import-questions.js  # AI import API
├── auth.js            # Frontend authentication module
├── app.js             # Main application logic
├── config-data.js     # Embedded question data (for file:// mode)
├── config.json        # Question data (for server mode)
├── db.js              # Database connection & initialization
├── index.html         # HTML structure
├── package.json       # Dependencies
├── server.js          # Express server
├── solutions.js       # Solution mappings
├── styles.css         # Styling
└── .env               # Environment variables (create from .env.example)
```

## API Endpoints

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/signup` | Create new account |
| POST | `/api/auth/login` | Login to account |
| GET | `/api/auth/me` | Get current user info |

### Import

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/import-questions` | AI import questions from file |

## Usage

### Student View
- See questions without hints/answers
- Practice mode (one-by-one with timer)
- Filter by paper and category

### Admin View
- See hints and answers for each question
- Import questions using AI
- Export combined JSON

## Development

The server runs on http://localhost:3000. Press `Ctrl+C` to stop.
