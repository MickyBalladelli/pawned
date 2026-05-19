import { useState } from 'react';
import { Button, Container, Typography, Box, Card, CardContent, CardActions } from '@mui/material';
import { GitHub, Twitter, Link as LinkIcon, Chat as ChatIcon } from '@mui/icons-material';
import './App.css';

function App() {
  const [count, setCount] = useState(0);

  return (
    <Container maxWidth="md">
      <Box sx={{ my: 4 }}>
        <Box
          component="img"
          src="/images/vela.png"
          alt="Vela"
          sx={{
            display: 'block',
            width: '100%',
            maxWidth: 560,
            height: 'auto',
            mx: 'auto',
            mb: 4,
            borderRadius: 2,
          }}
        />

        <Typography variant="h2" component="h1" gutterBottom>
          Welcome to Vela Client
        </Typography>
        <Typography variant="h5" component="h2" gutterBottom>
          React, Vite, and Material UI
        </Typography>
        
        <Card sx={{ my: 4 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Counter Example
            </Typography>
            <Typography variant="body1" gutterBottom>
              Edit <code>src/App.jsx</code> and save to test <code>HMR</code>
            </Typography>
            <Box sx={{ my: 2 }}>
              <Button 
                variant="contained" 
                onClick={() => setCount((count) => count + 1)}
              >
                Count is {count}
              </Button>
            </Box>
          </CardContent>
        </Card>

        <Card sx={{ my: 4 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Documentation
            </Typography>
            <Typography variant="body1" gutterBottom>
              Your questions, answered
            </Typography>
            <CardActions>
              <Button startIcon={<LinkIcon />} href="https://vite.dev/" target="_blank">
                Explore Vite
              </Button>
              <Button startIcon={<LinkIcon />} href="https://react.dev/" target="_blank">
                Learn more
              </Button>
            </CardActions>
          </CardContent>
        </Card>

        <Card sx={{ my: 4 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Connect with us
            </Typography>
            <Typography variant="body1" gutterBottom>
              Join the Vite community
            </Typography>
            <CardActions>
              <Button startIcon={<GitHub />} href="https://github.com/vitejs/vite" target="_blank">
                GitHub
              </Button>
              <Button startIcon={<ChatIcon />} href="https://chat.vite.dev/" target="_blank">
                Discord
              </Button>
              <Button startIcon={<Twitter />} href="https://x.com/vite_js" target="_blank">
                X.com
              </Button>
            </CardActions>
          </CardContent>
        </Card>
      </Box>
    </Container>
  );
}

export default App;
