# Vela MMO Chat Client

A modern React/Material UI client for the Vela MMO chat server.

## Features

- Real-time messaging using Socket.IO
- Channel management (create, join, leave)
- User authentication simulation
- Admin panel for channel management
- Responsive design for all screen sizes
- Dark theme UI with Material Design components

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn

### Installation

1. Clone the repository
2. Navigate to the client directory:
   ```bash
   cd client-react
   ```
3. Install dependencies:
   ```bash
   npm install
   ```

### Running the Application

1. Make sure the server is running (on port 4000)
2. Start the client:
   ```bash
   npm run dev
   ```

The application will be available at `http://localhost:5050`

## Project Structure

```
src/
├── App.js              # Main application component
├── index.js            # Entry point
├── components/         # Reusable components
└── styles/             # Custom styles
```

## Dependencies

- React 18
- Material UI 5
- Socket.IO Client
- React DOM

## Development

This client uses React with Material UI components for a modern, responsive interface. The application connects to the Vela server using Socket.IO for real-time communication.

## License

This project is licensed under the MIT License.