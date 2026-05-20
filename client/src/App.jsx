import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  Divider,
  FormControlLabel,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Add,
  Delete,
  Edit,
  Forum,
  Lock,
  Public,
  Refresh,
  Save,
} from '@mui/icons-material';
import './App.css';

const authTokenKey = 'velaAuthToken';

const emptyForm = {
  name: '',
  description: '',
  is_private: false,
};

async function requestJson(url, options) {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.error || 'Request failed');
  }

  return payload;
}

function formatDate(value) {
  if (!value) {
    return 'Unknown';
  }

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

function App() {
  const [channels, setChannels] = useState([]);
  const [selectedChannelId, setSelectedChannelId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [authForm, setAuthForm] = useState({ username: '', password: '' });
  const [authToken, setAuthToken] = useState(() => localStorage.getItem(authTokenKey));
  const [authUser, setAuthUser] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(Boolean(localStorage.getItem(authTokenKey)));
  const [authenticating, setAuthenticating] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [loadingChannels, setLoadingChannels] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [notice, setNotice] = useState(null);
  const [error, setError] = useState(null);

  const selectedChannel = useMemo(
    () => channels.find((channel) => channel.id === selectedChannelId),
    [channels, selectedChannelId],
  );
  const isAdmin = Boolean(authUser?.is_admin);

  function getAuthHeaders() {
    return authToken ? { Authorization: `Bearer ${authToken}` } : {};
  }

  function clearAuth() {
    localStorage.removeItem(authTokenKey);
    setAuthToken(null);
    setAuthUser(null);
    setLoadingAuth(false);
    setEditingId(null);
    setForm(emptyForm);
  }

  async function loadChannels() {
    setLoadingChannels(true);
    setError(null);

    try {
      const data = await requestJson('/api/channels');
      setChannels(data);

      if (data.length > 0) {
        setSelectedChannelId((currentId) => {
          const stillExists = data.some((channel) => channel.id === currentId);
          return stillExists ? currentId : data[0].id;
        });
      } else {
        setSelectedChannelId(null);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingChannels(false);
    }
  }

  async function loadMessages(channelId) {
    if (!channelId) {
      setMessages([]);
      return;
    }

    setLoadingMessages(true);

    try {
      const data = await requestJson(`/api/channels/${channelId}/messages?limit=20`);
      setMessages(data);
    } catch (err) {
      setError(err.message);
      setMessages([]);
    } finally {
      setLoadingMessages(false);
    }
  }

  useEffect(() => {
    const load = Promise.resolve().then(() => loadChannels());
    return () => {
      load.catch(() => {});
    };
  }, []);

  useEffect(() => {
    if (!authToken) {
      return undefined;
    }

    let isMounted = true;

    const load = requestJson('/api/auth/me', {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    })
      .then((data) => {
        if (isMounted) {
          setAuthUser(data.user);
        }
      })
      .catch(() => {
        if (isMounted) {
          clearAuth();
        }
      })
      .finally(() => {
        if (isMounted) {
          setLoadingAuth(false);
        }
      });

    return () => {
      isMounted = false;
      load.catch(() => {});
    };
  }, [authToken]);

  useEffect(() => {
    const load = Promise.resolve().then(() => loadMessages(selectedChannelId));
    return () => {
      load.catch(() => {});
    };
  }, [selectedChannelId]);

  function updateForm(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function startCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setNotice(null);
  }

  function startEdit(channel) {
    if (!isAdmin) {
      return;
    }

    setEditingId(channel.id);
    setForm({
      name: channel.name,
      description: channel.description || '',
      is_private: Boolean(channel.is_private),
    });
    setSelectedChannelId(channel.id);
    setNotice(null);
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!isAdmin) {
      setError('Admin access required');
      return;
    }

    if (!form.name.trim()) {
      setError('Channel name is required');
      return;
    }

    setSaving(true);
    setError(null);
    setNotice(null);

    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        is_private: form.is_private,
      };

      const channel = editingId
        ? await requestJson(`/api/channels/${editingId}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload),
          })
        : await requestJson('/api/channels', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload),
          });

      setNotice(editingId ? 'Channel updated' : 'Channel created');
      setSelectedChannelId(channel.id);
      setEditingId(null);
      setForm(emptyForm);
      await loadChannels();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(channel) {
    if (!isAdmin) {
      setError('Admin access required');
      return;
    }

    const confirmed = window.confirm(`Delete #${channel.name}?`);

    if (!confirmed) {
      return;
    }

    setDeletingId(channel.id);
    setError(null);
    setNotice(null);

    try {
      await requestJson(`/api/channels/${channel.id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      setNotice('Channel deleted');

      if (editingId === channel.id) {
        startCreate();
      }

      await loadChannels();
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingId(null);
    }
  }

  async function handleLogin(event) {
    event.preventDefault();

    setAuthenticating(true);
    setError(null);
    setNotice(null);

    try {
      const data = await requestJson('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(authForm),
      });

      localStorage.setItem(authTokenKey, data.token);
      setAuthToken(data.token);
      setAuthUser(data.user);
      setAuthForm({ username: '', password: '' });

      if (data.user.is_admin) {
        setNotice('Admin authenticated');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setAuthenticating(false);
    }
  }

  async function handleLogout() {
    if (authToken) {
      requestJson('/api/auth/logout', {
        method: 'POST',
        headers: getAuthHeaders(),
      }).catch(() => {});
    }

    clearAuth();
    setNotice(null);
  }

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 3, md: 5 } }}>
      <Stack spacing={3}>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={3}
          sx={{ alignItems: { xs: 'stretch', md: 'center' } }}
        >
          <Box
            component="img"
            src="/images/vela.png"
            alt="Vela"
            sx={{
              width: { xs: '100%', md: 260 },
              maxHeight: 180,
              objectFit: 'cover',
              borderRadius: 2,
            }}
          />
          <Box sx={{ flex: 1, textAlign: { xs: 'left', md: 'left' } }}>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1 }}>
              <Forum color="primary" />
              <Typography variant="overline" color="text.secondary">
                Chat operations
              </Typography>
            </Stack>
            <Typography variant="h3" component="h1" sx={{ fontWeight: 700, mb: 1 }}>
              {isAdmin ? 'Channel Admin' : 'Channels'}
            </Typography>
            <Typography color="text.secondary">
              {isAdmin
                ? 'Manage public and private chat channels from the server API.'
                : 'Browse available chat channels from the server API.'}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            {authUser && (
              <Button variant="outlined" onClick={handleLogout}>
                Sign out
              </Button>
            )}
            <Tooltip title="Refresh channels">
              <span>
                <IconButton
                  color="primary"
                  onClick={loadChannels}
                  disabled={loadingChannels}
                  sx={{ alignSelf: { xs: 'flex-start', md: 'center' } }}
                >
                  <Refresh />
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
        </Stack>

        {error && (
          <Alert severity="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}
        {notice && (
          <Alert severity="success" onClose={() => setNotice(null)}>
            {notice}
          </Alert>
        )}

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'minmax(320px, 0.95fr) minmax(0, 1.35fr)' },
            gap: 3,
            alignItems: 'start',
          }}
        >
          <Card>
            <CardContent>
              <Stack
                direction="row"
                sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 2 }}
              >
                <Typography variant="h5" component="h2">
                  Channels
                </Typography>
                {isAdmin && (
                  <Button startIcon={<Add />} size="small" onClick={startCreate}>
                    New
                  </Button>
                )}
              </Stack>

              {loadingChannels ? (
                <Stack sx={{ alignItems: 'center', py: 6 }}>
                  <CircularProgress />
                </Stack>
              ) : channels.length === 0 ? (
                <Paper variant="outlined" sx={{ p: 3, textAlign: 'center' }}>
                  <Typography color="text.secondary">No channels yet</Typography>
                </Paper>
              ) : (
                <List disablePadding>
                  {channels.map((channel) => (
                    <ListItemButton
                      key={channel.id}
                      selected={channel.id === selectedChannelId}
                      onClick={() => setSelectedChannelId(channel.id)}
                      sx={{ borderRadius: 1, mb: 0.5 }}
                    >
                      <ListItemText
                        primary={
                          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                            <Typography fontWeight={700}>#{channel.name}</Typography>
                            <Chip
                              size="small"
                              icon={channel.is_private ? <Lock /> : <Public />}
                              label={channel.is_private ? 'Private' : 'Public'}
                              variant="outlined"
                            />
                          </Stack>
                        }
                        secondary={channel.description || 'No description'}
                      />
                      {isAdmin && (
                        <Stack direction="row" spacing={0.5}>
                          <Tooltip title="Edit channel">
                            <IconButton
                              edge="end"
                              size="small"
                              onClick={(event) => {
                                event.stopPropagation();
                                startEdit(channel);
                              }}
                            >
                              <Edit fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete channel">
                            <span>
                              <IconButton
                                edge="end"
                                size="small"
                                color="error"
                                disabled={deletingId === channel.id}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleDelete(channel);
                                }}
                              >
                                <Delete fontSize="small" />
                              </IconButton>
                            </span>
                          </Tooltip>
                        </Stack>
                      )}
                    </ListItemButton>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>

          <Stack spacing={3}>
            {isAdmin ? (
              <Card>
                <CardContent component="form" onSubmit={handleSubmit}>
                  <Typography variant="h5" component="h2" sx={{ mb: 2 }}>
                    {editingId ? 'Edit Channel' : 'Create Channel'}
                  </Typography>
                  <Stack spacing={2}>
                    <TextField
                      label="Name"
                      value={form.name}
                      onChange={(event) => updateForm('name', event.target.value)}
                      fullWidth
                      required
                    />
                    <TextField
                      label="Description"
                      value={form.description}
                      onChange={(event) => updateForm('description', event.target.value)}
                      fullWidth
                      multiline
                      minRows={3}
                    />
                    <FormControlLabel
                      control={
                        <Switch
                          checked={form.is_private}
                          onChange={(event) => updateForm('is_private', event.target.checked)}
                        />
                      }
                      label="Private channel"
                    />
                    <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
                      {editingId && (
                        <Button onClick={startCreate} disabled={saving}>
                          Cancel
                        </Button>
                      )}
                      <Button
                        type="submit"
                        variant="contained"
                        startIcon={<Save />}
                        disabled={saving}
                      >
                        {saving ? 'Saving' : editingId ? 'Save' : 'Create'}
                      </Button>
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>
            ) : !authUser && !loadingAuth ? (
              <Card>
                <CardContent component="form" onSubmit={handleLogin}>
                  <Typography variant="h5" component="h2" sx={{ mb: 2 }}>
                    Admin sign in
                  </Typography>
                  <Stack spacing={2}>
                    <TextField
                      label="Username"
                      value={authForm.username}
                      onChange={(event) =>
                        setAuthForm((current) => ({ ...current, username: event.target.value }))
                      }
                      fullWidth
                      required
                    />
                    <TextField
                      label="Password"
                      type="password"
                      value={authForm.password}
                      onChange={(event) =>
                        setAuthForm((current) => ({ ...current, password: event.target.value }))
                      }
                      fullWidth
                    />
                    <Button type="submit" variant="contained" disabled={authenticating}>
                      {authenticating ? 'Signing in' : 'Sign in'}
                    </Button>
                  </Stack>
                </CardContent>
              </Card>
            ) : null}

            <Card>
              <CardContent>
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={1}
                  sx={{
                    alignItems: { xs: 'flex-start', sm: 'center' },
                    justifyContent: 'space-between',
                    mb: 2,
                  }}
                >
                  <Box>
                    <Typography variant="h5" component="h2">
                      {selectedChannel ? `#${selectedChannel.name}` : 'Messages'}
                    </Typography>
                    {selectedChannel && (
                      <Typography variant="body2" color="text.secondary">
                        Created {formatDate(selectedChannel.created_at)}
                      </Typography>
                    )}
                  </Box>
                  {selectedChannel && (
                    <Chip
                      icon={selectedChannel.is_private ? <Lock /> : <Public />}
                      label={selectedChannel.is_private ? 'Private' : 'Public'}
                      color={selectedChannel.is_private ? 'secondary' : 'primary'}
                      variant="outlined"
                    />
                  )}
                </Stack>

                <Divider sx={{ mb: 2 }} />

                {loadingMessages ? (
                  <Stack sx={{ alignItems: 'center', py: 6 }}>
                    <CircularProgress />
                  </Stack>
                ) : !selectedChannel ? (
                  <Typography color="text.secondary">Select a channel</Typography>
                ) : messages.length === 0 ? (
                  <Typography color="text.secondary">No messages in this channel</Typography>
                ) : (
                  <Stack spacing={1.5}>
                    {messages.map((message) => (
                      <Paper key={message.id} variant="outlined" sx={{ p: 2 }}>
                        <Stack
                          direction="row"
                          spacing={1}
                          sx={{ alignItems: 'baseline', justifyContent: 'space-between', mb: 0.5 }}
                        >
                          <Typography fontWeight={700}>{message.username}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {formatDate(message.created_at)}
                          </Typography>
                        </Stack>
                        <Typography sx={{ whiteSpace: 'pre-wrap' }}>{message.content}</Typography>
                      </Paper>
                    ))}
                  </Stack>
                )}
              </CardContent>
            </Card>
          </Stack>
        </Box>
      </Stack>
    </Container>
  );
}

export default App;
