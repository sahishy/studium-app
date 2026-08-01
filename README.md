<h1 align="center">
    <a href="https://studium-app.com/">
    <img src="https://studium-app.com/favicon.ico" alt="Studium" width="28" height="28" />
    </a>
  <b>Studium</b><br>
</h1>

<p align="center">
  A study platform for organizing courses, planning work, and playing academic games with others.
</p>

<p align="center">
    <a href="https://react.dev/">
    <img src="https://img.shields.io/badge/React-19-61DAFB.svg?logo=react&logoColor=white" alt="React 19" />
    </a>
    <a href="https://tailwindcss.com/">
    <img src="https://img.shields.io/badge/Tailwind_CSS-4-06B6D4.svg?logo=tailwindcss&logoColor=white" alt="Tailwind CSS 4" />
    </a>
  <a href="https://firebase.google.com/">
    <img src="https://img.shields.io/badge/Firebase-Auth%20%7C%20Firestore%20%7C%20Functions-FFCA28.svg" alt="Firebase" />
  </a>
  <a href="https://github.com/sahishy/studium-app/blob/main/LICENSE">
    <img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT License" />
  </a>
</p>

## Overview

Studium is a web app for managing school work in one place. It includes course organization, task planning, a calendar and board view, social features, and multiplayer academic games.

## Features

- Create and organize courses
- Add, edit, and review course information
- Manage tasks in list, board, and calendar views
- Create tasks from natural-language input
- Track work by course and due date
- Sign in and manage a profile
- Connect with other users through circles
- Play multiplayer SAT-style quiz games
- Join matchmaking queues, game rooms, and in-game chat

## Tech stack

| Area | Tools |
| --- | --- |
| Frontend | React, Vite, Tailwind CSS |
| Backend | Firebase Cloud Functions, Express |
| Database and auth | Firebase Authentication, Firestore, Storage |
| Multiplayer | Firebase, Express, Phaser |
| 3D interface | Three.js, React Three Fiber |
| Deployment | Firebase Hosting |

## Simple project structure

Design pattern: Feature-driven development

```text
studium-app/
├── frontend/          # React and Vite application
│   └── src/
│       └── features/  # Courses, agenda, profile, multiplayer, and more
├── backend/           # Firebase Cloud Functions and Express routes
│   └── src/
│       └── features/  # Multiplayer services and game logic
```

## Firebase Emulators

```npm run emulators:start```
```npm run emulators:stop```

## Frontend Testing

```cd frontend```
```npm run dev```