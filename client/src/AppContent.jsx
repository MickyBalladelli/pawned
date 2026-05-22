import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  Divider,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Menu,
  MenuItem,
  Paper,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import {
  Add,
  Delete,
  Edit,
  Forum,
  Lock,
  Public,
  Refresh,
  Save,
  Send,
  Settings,
} from '@mui/icons-material'
import AccountSettingsPage from './AccountSettingsPage'
import ChannelMessageList from './ChannelMessageList'
import { requestJson } from './requestJson'

const emptyForm = {
  name: '',
  description: '',
  is_private: false,
}

let socketIoClientPromise

function loadSocketIoClient() {
  if (window.io) {
    return Promise.resolve(window.io)
  }

  if (!socketIoClientPromise) {
    socketIoClientPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = '/socket.io/socket.io.js'
      script.async = true
      script.onload = () => {
        if (window.io) {
          resolve(window.io)
        } else {
          reject(new Error('Socket client unavailable'))
        }
      }
      script.onerror = () => reject(new Error('Failed to load socket client'))
      document.head.appendChild(script)
    })
  }

  return socketIoClientPromise
}

function formatDate(value) {
  if (!value) {
    return 'Unknown'
  }

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

function getInitial(username) {
  return username?.trim().charAt(0).toUpperCase() || '?'
}

function AppContent({ authToken, authUser, onLogout, onUserUpdated }) {
  const [channels, setChannels] = useState([])
  const [selectedChannelId, setSelectedChannelId] = useState(null)
  const [messages, setMessages] = useState([])
  const [socket, setSocket] = useState(null)
  const [socketConnected, setSocketConnected] = useState(false)
  const [draftMessage, setDraftMessage] = useState('')
  const [form, setForm] = useState(emptyForm)
  const [channelDialogOpen, setChannelDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [loadingChannels, setLoadingChannels] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [sendingMessage, setSendingMessage] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [notice, setNotice] = useState(null)
  const [error, setError] = useState(null)
  const [showSettings, setShowSettings] = useState(false)
  const [accountMenuAnchor, setAccountMenuAnchor] = useState(null)
  const selectedChannelIdRef = useRef(null)
  const messagesEndRef = useRef(null)

  const selectedChannel = useMemo(
    () => channels.find((channel) => channel.id === selectedChannelId),
    [channels, selectedChannelId],
  )
  const isAdmin = Boolean(authUser?.is_admin)

  const getAuthHeaders = useCallback(() => {
    return authToken ? { Authorization: `Bearer ${authToken}` } : {}
  }, [authToken])

  const loadChannels = useCallback(async () => {
    setLoadingChannels(true)
    setError(null)

    try {
      const data = await requestJson('/api/channels', {
        headers: getAuthHeaders(),
      })
      setChannels(data)

      if (data.length > 0) {
        setSelectedChannelId((currentId) => {
          const stillExists = data.some((channel) => channel.id === currentId)
          return stillExists ? currentId : data[0].id
        })
      } else {
        setSelectedChannelId(null)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoadingChannels(false)
    }
  }, [getAuthHeaders])

  const loadMessages = useCallback(async (channelId) => {
    if (!channelId) {
      setMessages([])
      return
    }

    setLoadingMessages(true)

    try {
      const data = await requestJson(`/api/channels/${channelId}/messages?limit=20`, {
        headers: getAuthHeaders(),
      })
      setMessages(data.slice().reverse())
    } catch (err) {
      setError(err.message)
      setMessages([])
    } finally {
      setLoadingMessages(false)
    }
  }, [getAuthHeaders])

  useEffect(() => {
    const load = Promise.resolve().then(() => loadChannels())
    return () => {
      load.catch(() => {})
    }
  }, [loadChannels])

  useEffect(() => {
    selectedChannelIdRef.current = selectedChannelId
  }, [selectedChannelId])

  useEffect(() => {
    let active = true
    let liveSocket

    loadSocketIoClient()
      .then((ioClient) => {
        if (!active) {
          return
        }

        liveSocket = ioClient({
          auth: { token: authToken },
          transports: ['websocket', 'polling'],
        })

        liveSocket.on('connect', () => {
          setSocketConnected(true)
          setError(null)
        })

        liveSocket.on('disconnect', () => {
          setSocketConnected(false)
        })

        liveSocket.on('connect_error', () => {
          setSocketConnected(false)
          setError('Chat connection failed')
        })

        liveSocket.on('chatError', (message) => {
          setError(message)
        })

        liveSocket.on('receiveMessage', (message) => {
          const currentChannelId = selectedChannelIdRef.current

          if (Number(message.channel_id) !== Number(currentChannelId)) {
            return
          }

          setMessages((current) => {
            if (current.some((item) => item.id === message.id)) {
              return current
            }

            return [...current, message]
          })
        })

        liveSocket.on('messageDeleted', (message) => {
          const currentChannelId = selectedChannelIdRef.current

          if (Number(message.channel_id) !== Number(currentChannelId)) {
            return
          }

          setMessages((current) => current.filter((item) => item.id !== message.id))
        })

        setSocket(liveSocket)
      })
      .catch((err) => {
        setError(err.message)
      })

    return () => {
      active = false
      if (liveSocket) {
        liveSocket.disconnect()
      }
      setSocket(null)
      setSocketConnected(false)
    }
  }, [authToken])

  useEffect(() => {
    const load = Promise.resolve().then(() => loadMessages(selectedChannelId))
    return () => {
      load.catch(() => {})
    }
  }, [loadMessages, selectedChannelId])

  useEffect(() => {
    if (!socket || !selectedChannelId) {
      return undefined
    }

    socket.emit('joinChannel', selectedChannelId)

    return () => {
      socket.emit('leaveChannel', selectedChannelId)
    }
  }, [selectedChannelId, socket])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, selectedChannelId])

  function updateForm(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }))
  }

  function startCreate() {
    setEditingId(null)
    setForm(emptyForm)
    setChannelDialogOpen(true)
    setNotice(null)
  }

  function closeChannelDialog() {
    if (saving) {
      return
    }

    setChannelDialogOpen(false)
    setEditingId(null)
    setForm(emptyForm)
  }

  function startEdit(channel) {
    if (!isAdmin) {
      return
    }

    setEditingId(channel.id)
    setForm({
      name: channel.name,
      description: channel.description || '',
      is_private: Boolean(channel.is_private),
    })
    setChannelDialogOpen(true)
    setSelectedChannelId(channel.id)
    setNotice(null)
  }

  async function handleSubmit(event) {
    event.preventDefault()

    if (!isAdmin) {
      setError('Admin access required')
      return
    }

    if (!form.name.trim()) {
      setError('Channel name is required')
      return
    }

    setSaving(true)
    setError(null)
    setNotice(null)

    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        is_private: form.is_private,
      }

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
          })

      setNotice(editingId ? 'Channel updated' : 'Channel created')
      setSelectedChannelId(channel.id)
      setEditingId(null)
      setForm(emptyForm)
      setChannelDialogOpen(false)
      await loadChannels()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(channel) {
    if (!isAdmin) {
      setError('Admin access required')
      return
    }

    const confirmed = window.confirm(`Delete #${channel.name}?`)

    if (!confirmed) {
      return
    }

    setDeletingId(channel.id)
    setError(null)
    setNotice(null)

    try {
      await requestJson(`/api/channels/${channel.id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      })
      setNotice('Channel deleted')

      if (editingId === channel.id) {
        closeChannelDialog()
      }

      await loadChannels()
    } catch (err) {
      setError(err.message)
    } finally {
      setDeletingId(null)
    }
  }

  function handleLogout() {
    setAccountMenuAnchor(null)
    onLogout()
    setNotice(null)
  }

  function handleShowSettings() {
    setAccountMenuAnchor(null)
    setShowSettings(true)
    setError(null)
    setNotice(null)
  }

  function handleUserUpdated(user) {
    onUserUpdated(user)
    setMessages((current) =>
      current.map((message) =>
        message.user_id === user.id
          ? { ...message, avatar_url: user.avatar_url, username: user.username }
          : message,
      ),
    )
  }

  async function handleDeleteMessage(message) {
    setError(null)
    setNotice(null)

    try {
      await requestJson(`/api/messages/${message.id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      })
      setMessages((current) => current.filter((item) => item.id !== message.id))
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleSendMessage(event) {
    event.preventDefault()

    const message = draftMessage.trim()

    if (!selectedChannel || !message) {
      return
    }

    if (!socket || !socketConnected) {
      setError('Chat is not connected')
      return
    }

    setSendingMessage(true)
    setError(null)

    try {
      const response = await new Promise((resolve, reject) => {
        socket.timeout(5000).emit(
          'sendMessage',
          {
            channelId: selectedChannel.id,
            message,
          },
          (err, payload) => {
            if (err) {
              reject(new Error('Message timed out'))
              return
            }

            if (payload?.error) {
              reject(new Error(payload.error))
              return
            }

            resolve(payload)
          },
        )
      })

      if (response?.message) {
        setDraftMessage('')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setSendingMessage(false)
    }
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
            {isAdmin && (
              <Button variant="contained" startIcon={<Add />} onClick={startCreate}>
                New channel
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
            <Tooltip title="Account">
              <IconButton
                onClick={(event) => setAccountMenuAnchor(event.currentTarget)}
                sx={{ p: 0.25 }}
              >
                <Avatar
                  src={authUser.avatar_url || undefined}
                  sx={{ width: 36, height: 36, fontSize: 15, fontWeight: 800, bgcolor: 'primary.main' }}
                >
                  {getInitial(authUser.username)}
                </Avatar>
              </IconButton>
            </Tooltip>
            <Menu
              anchorEl={accountMenuAnchor}
              open={Boolean(accountMenuAnchor)}
              onClose={() => setAccountMenuAnchor(null)}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            >
              <MenuItem onClick={handleShowSettings}>
                <Settings fontSize="small" sx={{ mr: 1 }} />
                Settings
              </MenuItem>
              <MenuItem onClick={handleLogout}>Sign out</MenuItem>
            </Menu>
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

        {showSettings ? (
          <AccountSettingsPage
            authToken={authToken}
            user={authUser}
            onBack={() => setShowSettings(false)}
            onUserUpdated={handleUserUpdated}
          />
        ) : (
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
                                event.stopPropagation()
                                startEdit(channel)
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
                                  event.stopPropagation()
                                  handleDelete(channel)
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
                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                      <Chip
                        label={socketConnected ? 'Live' : 'Offline'}
                        color={socketConnected ? 'success' : 'default'}
                        variant="outlined"
                      />
                      <Chip
                        icon={selectedChannel.is_private ? <Lock /> : <Public />}
                        label={selectedChannel.is_private ? 'Private' : 'Public'}
                        color={selectedChannel.is_private ? 'secondary' : 'primary'}
                        variant="outlined"
                      />
                    </Stack>
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
                  <ChannelMessageList
                    authUser={authUser}
                    messages={messages}
                    endRef={messagesEndRef}
                    onDeleteMessage={handleDeleteMessage}
                  />
                )}

                {selectedChannel && (
                  <Box component="form" onSubmit={handleSendMessage} sx={{ mt: 2 }}>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                      <TextField
                        label={`Message #${selectedChannel.name}`}
                        value={draftMessage}
                        onChange={(event) => setDraftMessage(event.target.value)}
                        size="small"
                        fullWidth
                        multiline
                        maxRows={4}
                        disabled={sendingMessage}
                      />
                      <Button
                        type="submit"
                        variant="contained"
                        endIcon={<Send />}
                        disabled={!draftMessage.trim() || sendingMessage || !socketConnected}
                        sx={{ minWidth: { xs: '100%', sm: 120 } }}
                      >
                        {sendingMessage ? 'Sending' : 'Send'}
                      </Button>
                    </Stack>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Stack>
          </Box>
        )}
      </Stack>

      {isAdmin && (
        <Dialog
          open={channelDialogOpen}
          onClose={closeChannelDialog}
          fullWidth
          maxWidth="sm"
        >
          <DialogTitle>{editingId ? 'Edit Channel' : 'Create Channel'}</DialogTitle>
          <DialogContent component="form" id="channel-form" onSubmit={handleSubmit}>
            <Stack spacing={2} sx={{ pt: 1 }}>
              <TextField
                label="Name"
                value={form.name}
                onChange={(event) => updateForm('name', event.target.value)}
                size="small"
                fullWidth
                required
              />
              <TextField
                label="Description"
                value={form.description}
                onChange={(event) => updateForm('description', event.target.value)}
                size="small"
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
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={closeChannelDialog} disabled={saving}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="channel-form"
              variant="contained"
              startIcon={<Save />}
              disabled={saving}
            >
              {saving ? 'Saving' : editingId ? 'Save' : 'Create'}
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </Container>
  )
}

export default AppContent
