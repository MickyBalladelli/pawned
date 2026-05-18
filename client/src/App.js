import React, { useState, useEffect } from 'react';
import { 
  Container, 
  Grid, 
  Paper, 
  Typography, 
  List, 
  ListItem, 
  ListItemText, 
  ListItemIcon, 
  TextField, 
  Button, 
  Box, 
  Divider,
  Chip,
  IconButton,
  AppBar,
  Toolbar,
  Avatar,
  CircularProgress
} from '@mui/material';
import { 
  Chat as ChatIcon, 
  Public as PublicIcon, 
  Lock as LockIcon,
  Add as AddIcon,
  Send as SendIcon,
  Person as PersonIcon,
  AdminPanelSettings as AdminPanelSettingsIcon
} from '@mui/icons-material';
import io from 'socket.io-client';

const App = () => {
  const [channels, setChannels] = useState([]);
  const [messages, setMessages] = useState([]);
  const [currentChannel, setCurrentChannel] = useState(null);
  const [messageInput, setMessageInput] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelDescription, setNewChannelDescription] = useState('');
  const [socket, setSocket] = useState(null);
  const [userCount, setUserCount] = useState(0);

  // Initialize the app
  useEffect(() => {
    // Connect to the server
    const newSocket = io('http://localhost:8080');
    setSocket(newSocket);

    // Set up socket event listeners
    newSocket.on('connect', () => {
      console.log('Connected to server');
    });

    newSocket.on('receiveMessage', (message) => {
      if (currentChannel && message.channel_id === currentChannel.id) {
        setMessages(prev => [...prev, message]);
      }
    });

    newSocket.on('channelCreated', (channel) => {
      loadChannels();
    });

    newSocket.on('channelUpdated', (channel) => {
      loadChannels();
    });

    newSocket.on('channelDeleted', (channelId) => {
      loadChannels();
      if (currentChannel && currentChannel.id === channelId) {
        setCurrentChannel(null);
        setMessages([]);
      }
    });

    newSocket.on('userCount', (count) => {
      setUserCount(count);
    });

    // Initialize user
    const user = {
      id: Math.floor(Math.random() * 1000),
      username: 'Player' + Math.floor(Math.random() * 100),
      isAdmin: Math.random() > 0.9 // 10% chance of being admin for demo purposes
    };
    
    setCurrentUser(user);
    setIsAdmin(user.isAdmin);

    // Load channels
    loadChannels();

    // Cleanup
    return () => {
      newSocket.disconnect();
    };
  }, []);

  // Load all channels
  const loadChannels = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/channels');
      const data = await response.json();
      setChannels(data);
      
      if (data.length > 0 && !currentChannel) {
        setCurrentChannel(data[0]);
      }
      
      setIsLoading(false);
    } catch (error) {
      console.error('Error loading channels:', error);
      setIsLoading(false);
    }
  };

  // Join a channel
  const joinChannel = (channel) => {
    if (socket && currentChannel) {
      socket.emit('leaveChannel', currentChannel.id);
    }
    
    setCurrentChannel(channel);
    if (socket) {
      socket.emit('joinChannel', channel.id);
    }
    
    loadMessages(channel.id);
  };

  // Load messages for a channel
  const loadMessages = async (channelId) => {
    try {
      const response = await fetch(`http://localhost:3000/api/channels/${channelId}/messages?limit=50`);
      const data = await response.json();
      setMessages(data);
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  // Send a message
  const sendMessage = () => {
    if (!messageInput.trim() || !currentChannel || !socket) return;

    const message = {
      channelId: currentChannel.id,
      userId: currentUser.id,
      message: messageInput.trim()
    };

    socket.emit('sendMessage', message);
    setMessageInput('');
  };

  // Create a new channel
  const createChannel = async () => {
    if (!newChannelName.trim() || !socket) return;

    try {
      const response = await fetch('/api/channels', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: newChannelName,
          description: newChannelDescription,
          is_private: false
        })
      });

      if (response.ok) {
        setNewChannelName('');
        setNewChannelDescription('');
        loadChannels();
      }
    } catch (error) {
      console.error('Error creating channel:', error);
    }
  };

  // Format timestamp
  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (isLoading) {
    return (
      <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 2, mb: 2 }}>
      <AppBar position="static" sx={{ mb: 2 }}>
        <Toolbar>
          <ChatIcon sx={{ mr: 2 }} />
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Vela MMO Chat
          </Typography>
          <Box display="flex" alignItems="center" gap={2}>
            <Typography variant="body2">
              Users online: {userCount}
            </Typography>
            {currentUser && (
              <Box display="flex" alignItems="center" gap={1}>
                <Avatar sx={{ width: 32, height: 32 }}>
                  <PersonIcon />
                </Avatar>
                <Typography variant="body2">
                  {currentUser.username}
                </Typography>
                {isAdmin && (
                  <Chip 
                    label="Admin" 
                    icon={<AdminPanelSettingsIcon />} 
                    size="small" 
                    color="secondary" 
                  />
                )}
              </Box>
            )}
          </Box>
        </Toolbar>
      </AppBar>

      <Grid container spacing={2}>
        {/* Channels Panel */}
        <Grid item xs={12} md={3}>
          <Paper sx={{ p: 2, height: 'calc(100vh - 150px)', overflowY: 'auto' }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6" component="h2">
                <ChatIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                Channels
              </Typography>
              {isAdmin && (
                <IconButton 
                  onClick={createChannel} 
                  color="primary"
                  title="Create Channel"
                >
                  <AddIcon />
                </IconButton>
              )}
            </Box>

            <Divider sx={{ mb: 2 }} />

            <List>
              {channels.map((channel) => (
                <ListItem
                  key={channel.id}
                  button
                  onClick={() => joinChannel(channel)}
                  selected={currentChannel?.id === channel.id}
                  sx={{ 
                    mb: 1,
                    borderRadius: 1,
                    backgroundColor: currentChannel?.id === channel.id ? 'primary.light' : 'transparent'
                  }}
                >
                  <ListItemIcon>
                    {channel.is_private ? <LockIcon /> : <PublicIcon />}
                  </ListItemIcon>
                  <ListItemText 
                    primary={channel.name}
                    secondary={channel.description || 'No description'}
                  />
                  {channel.is_private && (
                    <Chip 
                      label="Private" 
                      size="small" 
                      color="default" 
                      variant="outlined" 
                      sx={{ ml: 1 }}
                    />
                  )}
                </ListItem>
              ))}
            </List>

            {/* Admin Panel */}
            {isAdmin && (
              <Paper sx={{ p: 2, mt: 2 }}>
                <Typography variant="h6" component="h3" gutterBottom>
                  Create Channel
                </Typography>
                <TextField
                  fullWidth
                  label="Channel Name"
                  value={newChannelName}
                  onChange={(e) => setNewChannelName(e.target.value)}
                  margin="normal"
                />
                <TextField
                  fullWidth
                  label="Description"
                  value={newChannelDescription}
                  onChange={(e) => setNewChannelDescription(e.target.value)}
                  margin="normal"
                />
                <Button
                  fullWidth
                  variant="contained"
                  onClick={createChannel}
                  startIcon={<AddIcon />}
                  sx={{ mt: 1 }}
                >
                  Create Channel
                </Button>
              </Paper>
            )}
          </Paper>
        </Grid>

        {/* Messages Panel */}
        <Grid item xs={12} md={9}>
          <Paper sx={{ p: 2, height: 'calc(100vh - 150px)', display: 'flex', flexDirection: 'column' }}>
            {currentChannel ? (
              <>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="h5" component="h2">
                    {currentChannel.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {currentChannel.description || 'No description'}
                  </Typography>
                </Box>

                <Box 
                  sx={{ 
                    flex: 1, 
                    overflowY: 'auto', 
                    p: 2, 
                    backgroundColor: 'background.default',
                    borderRadius: 1,
                    mb: 2
                  }}
                >
                  {messages.map((message) => (
                    <Box key={message.id} sx={{ mb: 2 }}>
                      <Box display="flex" alignItems="center" gap={1}>
                        <Avatar sx={{ width: 32, height: 32, fontSize: '0.8rem' }}>
                          {message.username.charAt(0)}
                        </Avatar>
                        <Box>
                          <Typography variant="subtitle2" component="span">
                            {message.username}
                          </Typography>
                          <Typography variant="caption" component="span" sx={{ ml: 1 }}>
                            {formatTime(message.created_at)}
                          </Typography>
                        </Box>
                      </Box>
                      <Typography variant="body1" sx={{ mt: 1, ml: 5 }}>
                        {message.content}
                      </Typography>
                    </Box>
                  ))}
                </Box>

                <Box display="flex" gap={1}>
                  <TextField
                    fullWidth
                    label="Type your message..."
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                    variant="outlined"
                  />
                  <Button
                    variant="contained"
                    onClick={sendMessage}
                    endIcon={<SendIcon />}
                    disabled={!messageInput.trim()}
                  >
                    Send
                  </Button>
                </Box>
              </>
            ) : (
              <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
                <Typography variant="h6" color="text.secondary">
                  Select a channel to start chatting
                </Typography>
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
};

export default App;