import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  Avatar,
  Badge,
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
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Menu,
  MenuItem,
  Paper,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import {
  Add,
  Delete,
  DarkMode,
  Edit,
  Forum,
  Group,
  HourglassEmpty,
  LightMode,
  Lock,
  Public,
  Refresh,
  Save,
  School,
  Search,
  Send,
  Settings,
  EditOff,
  People
} from '@mui/icons-material'
import AccountSettingsPage from './AccountSettingsPage'
import ChannelSettingsToggles from './ChannelSettingsToggles'
import ChannelMessageList from './ChannelMessageList'
import ChannelMembershipDialog from './ChannelMembershipDialog'
import ChessIcon from './ChessIcon'
import ChessPage from './ChessPage'
import TrainingPage from './TrainingPage'
import UsersPage from './UsersPage'
import { requestJson } from './requestJson'

const emptyForm = {
  name: '',
  description: '',
  is_private: false,
  is_read_only: false,
}
const activeViewStorageKey = 'pawned.activeView'
const channelNameCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: 'base',
})

function getChannelSortName(channel) {
  return String(channel.name || '').trim()
}

function compareChannels(left, right) {
  const leftName = getChannelSortName(left)
  const rightName = getChannelSortName(right)
  const leftStartsWithNumber = /^\d/.test(leftName)
  const rightStartsWithNumber = /^\d/.test(rightName)

  if (leftStartsWithNumber !== rightStartsWithNumber) {
    return leftStartsWithNumber ? -1 : 1
  }

  return channelNameCollator.compare(leftName, rightName)
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

function getInitialActiveView() {
  const params = new URLSearchParams(window.location.search)

  if (params.has('chessGame')) {
    return 'chess'
  }

  const storedView = localStorage.getItem(activeViewStorageKey)
  return ['chat', 'chess', 'training', 'users'].includes(storedView) ? storedView : 'chat'
}

function AppContent({ authToken, authUser, themeMode, onLogout, onToggleTheme, onUserUpdated }) {
  const [channels, setChannels] = useState([])
  const [selectedChannelId, setSelectedChannelId] = useState(null)
  const [messages, setMessages] = useState([])
  const [socket, setSocket] = useState(null)
  const [socketConnected, setSocketConnected] = useState(false)
  const [draftMessage, setDraftMessage] = useState('')
  const [channelFilter, setChannelFilter] = useState('')
  const [form, setForm] = useState(emptyForm)
  const [channelDialogOpen, setChannelDialogOpen] = useState(false)
  const [membershipDialogOpen, setMembershipDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [loadingChannels, setLoadingChannels] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [sendingMessage, setSendingMessage] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [requestingChannelId, setRequestingChannelId] = useState(null)
  const [notice, setNotice] = useState(null)
  const [error, setError] = useState(null)
  const [showSettings, setShowSettings] = useState(false)
  const [activeView, setActiveView] = useState(getInitialActiveView)
  const [accountMenuAnchor, setAccountMenuAnchor] = useState(null)
  const [chessHeaderActions, setChessHeaderActions] = useState(null)
  const selectedChannelIdRef = useRef(null)
  const messagesEndRef = useRef(null)
  const messageInputRef = useRef(null)

  const selectedChannel = useMemo(
    () => channels.find((channel) => channel.id === selectedChannelId),
    [channels, selectedChannelId],
  )
  const isAdmin = Boolean(authUser?.is_admin || authUser?.role === 'admin' || authUser?.role === 'developer')
  const isModerator = Boolean(isAdmin || authUser?.role === 'moderator')
  const canUseSelectedChannel = Boolean(selectedChannel?.can_access)
  const canWriteSelectedChannel = Boolean(
    canUseSelectedChannel && (!selectedChannel?.is_read_only || isAdmin),
  )
  const canManageSelectedChannel = Boolean(selectedChannel?.can_manage)
  const filteredChannels = useMemo(() => {
    const filter = channelFilter.trim().toLowerCase()

    if (!filter) {
      return [...channels].sort(compareChannels)
    }

    return channels
      .filter((channel) => {
        return (
          channel.name?.toLowerCase().includes(filter) ||
          channel.description?.toLowerCase().includes(filter)
        )
      })
      .sort(compareChannels)
  }, [channelFilter, channels])

  const getAuthHeaders = useCallback(() => {
    return authToken ? { Authorization: `Bearer ${authToken}` } : {}
  }, [authToken])
  const authHeaders = useMemo(() => getAuthHeaders(), [getAuthHeaders])

  useEffect(() => {
    if (activeView === 'users' && !isAdmin) {
      setActiveView('chat')
      localStorage.setItem(activeViewStorageKey, 'chat')
    }
  }, [activeView, isAdmin])

  function handleActiveViewChange(event, value) {
    if (!value) {
      return
    }

    setActiveView(value)
    localStorage.setItem(activeViewStorageKey, value)

    if (value !== 'chess') {
      const url = new URL(window.location.href)
      url.searchParams.delete('chessGame')
      window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
    }
  }

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

    const channel = channels.find((item) => item.id === channelId)

    if (channel && !channel.can_access) {
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
  }, [channels, getAuthHeaders])

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

        liveSocket.on('channelPresence', (notice) => {
          if (authUser.show_channel_presence === false) {
            return
          }

          const currentChannelId = selectedChannelIdRef.current

          if (Number(notice.channel_id) !== Number(currentChannelId)) {
            return
          }

          const noticeId = notice.id || `presence-${Date.now()}`

          setMessages((current) => [
            ...current,
            {
              ...notice,
              id: noticeId,
              is_presence_notice: true,
              content: `${notice.username} has ${notice.type === 'join' ? 'joined' : 'left'} the channel`,
            },
          ])

          window.setTimeout(() => {
            setMessages((current) => current.filter((message) => message.id !== noticeId))
          }, 9000)
        })

        liveSocket.on('channelCreated', () => {
          loadChannels()
        })

        liveSocket.on('channelUpdated', () => {
          loadChannels()
        })

        liveSocket.on('channelDeleted', () => {
          loadChannels()
        })

        liveSocket.on('membershipRequestCreated', (request) => {
          setNotice(`${request.username} wants to join #${request.channel_name}`)
          loadChannels()
        })

        liveSocket.on('membershipRequestUpdated', (request) => {
          setNotice(request.status === 'approved' ? 'Membership approved' : 'Membership rejected')
          loadChannels()
        })

        liveSocket.on('userUpdated', (user) => {
          if (Number(user.id) !== Number(authUser.id)) {
            return
          }

          if (user.is_blocked) {
            onLogout()
            return
          }

          onUserUpdated(user)
        })

        liveSocket.on('userDeleted', () => {
          onLogout()
        })

        liveSocket.on('channelMembershipRemoved', () => {
          setNotice('You were removed from a private channel')
          setMessages([])
          loadChannels()
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
  }, [authToken, authUser.id, authUser.show_channel_presence, loadChannels, onLogout, onUserUpdated])

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

    if (!canUseSelectedChannel) {
      return undefined
    }

    socket.emit('joinChannel', selectedChannelId, (response) => {
      if (response?.error) {
        setError(response.error)
      }
    })

    return () => {
      socket.emit('leaveChannel', selectedChannelId)
    }
  }, [canUseSelectedChannel, selectedChannelId, socket])

  useEffect(() => {
    if (messages.at(-1)?.is_presence_notice) {
      return
    }

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
    setForm({
      ...emptyForm,
      is_private: !isAdmin,
    })
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
    if (!channel.can_manage) {
      return
    }

    setEditingId(channel.id)
    setForm({
      name: channel.name,
      description: channel.description || '',
      is_private: Boolean(channel.is_private),
      is_read_only: Boolean(channel.is_read_only),
    })
    setChannelDialogOpen(true)
    setSelectedChannelId(channel.id)
    setNotice(null)
  }

  async function handleSubmit(event) {
    event.preventDefault()

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
        is_private: isAdmin ? form.is_private : true,
        is_read_only: isAdmin ? form.is_read_only : false,
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
    if (!channel.can_manage) {
      setError('Channel owner access required')
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

  function focusMessageInput() {
    window.requestAnimationFrame(() => {
      messageInputRef.current?.focus()
    })
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

  async function handleBlockUser(userId) {
    if (!isModerator || !userId || Number(userId) === Number(authUser.id)) {
      return
    }

    setError(null)
    setNotice(null)

    try {
      const data = await requestJson(`/api/users/${userId}/block`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ blocked: true }),
      })
      setNotice(data.message)
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleRequestMembership(channel) {
    setRequestingChannelId(channel.id)
    setError(null)
    setNotice(null)

    try {
      await requestJson(`/api/channels/${channel.id}/membership-requests`, {
        method: 'POST',
        headers: getAuthHeaders(),
      })
      setNotice('Request sent')
      await loadChannels()
    } catch (err) {
      setError(err.message)
    } finally {
      setRequestingChannelId(null)
    }
  }

  async function handleSendMessage(event) {
    event.preventDefault()
    focusMessageInput()

    const message = draftMessage.trim()

    if (!selectedChannel || !message) {
      return
    }

    if (!canWriteSelectedChannel) {
      setError('Channel is read only')
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
        setMessages((current) => {
          if (current.some((item) => item.id === response.message.id)) {
            return current
          }

          return [...current, response.message]
        })
        setDraftMessage('')
        focusMessageInput()
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setSendingMessage(false)
      focusMessageInput()
    }
  }

  return (
    <Container maxWidth={false} sx={{ px: { xs: 1.5, md: 2 }, py: { xs: 1.5, md: 2 } }}>
      <Stack spacing={1.5}>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={1.5}
          sx={{ alignItems: { xs: 'stretch', md: 'center' } }}
        >
          <Box
            component="img"
            src="/images/pawned.png"
            alt="Pawned"
            sx={{
              width: { xs: '100%', sm: 120, md: 96 },
              height: { xs: 120, sm: 92, md: 72 },
              objectFit: 'contain',
              borderRadius: 2,
            }}
          />
          <Tabs
            value={activeView}
            onChange={handleActiveViewChange}
            sx={{
              minHeight: 36,
              borderBottom: { xs: 1, md: 0 },
              borderColor: 'divider',
              '& .MuiTab-root': {
                minHeight: 36,
                minWidth: 0,
                px: { xs: 1, sm: 1.25 },
                py: 0.5,
                fontSize: { xs: '0.75rem', sm: '0.8125rem' },
              },
              '& .MuiTab-iconWrapper': {
                fontSize: 18,
                mr: 0.5,
              },
            }}
          >
            <Tab icon={<Forum />} iconPosition="start" value="chat" label="Chat" />
            <Tab icon={<ChessIcon />} iconPosition="start" value="chess" label="Chess" />
            <Tab icon={<School />} iconPosition="start" value="training" label="Training" />
            {isAdmin && <Tab icon={<People />} iconPosition="start" value="users" label="Users" />}
          </Tabs>
          <Box sx={{ flex: 1, textAlign: { xs: 'left', md: 'left' } }}>
            
            <Typography
              variant="h3"
              component="h1"
              color="text.primary"
              sx={{ fontSize: { xs: 30, md: 34 }, fontWeight: 900, mb: 0 }}
            >
              {activeView === 'chat'
                ? (isAdmin ? 'Channel Admin' : 'Channels')
                : activeView === 'training'
                  ? 'Training'
                  : activeView === 'users'
                    ? 'Users'
                    : 'Chess'}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            {activeView === 'chat' && (
              <>
                <Button variant="contained" startIcon={<Add />} onClick={startCreate}>
                  {isAdmin ? 'New channel' : 'New private'}
                </Button>
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
              </>
            )}
            {activeView === 'chess' && chessHeaderActions && (
              <>
                <Button variant="contained" startIcon={<Add />} onClick={chessHeaderActions.onNewGame}>
                  New game
                </Button>
                <Tooltip title="Refresh games">
                  <span>
                    <IconButton
                      color="primary"
                      onClick={chessHeaderActions.onRefresh}
                      disabled={chessHeaderActions.loading}
                      sx={{ alignSelf: { xs: 'flex-start', md: 'center' } }}
                    >
                      <Refresh />
                    </IconButton>
                  </span>
                </Tooltip>
              </>
            )}
            <Tooltip title={themeMode === 'dark' ? 'Light theme' : 'Dark theme'}>
              <IconButton color="primary" onClick={onToggleTheme}>
                {themeMode === 'dark' ? <LightMode /> : <DarkMode />}
              </IconButton>
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
          <>
          {activeView === 'training' ? (
            <TrainingPage authToken={authToken} authUser={authUser} themeMode={themeMode} />
          ) : activeView === 'users' ? (
            <UsersPage
              authToken={authToken}
              authUser={authUser}
              onError={setError}
              onNotice={setNotice}
            />
          ) : activeView === 'chess' ? (
            <ChessPage
              authToken={authToken}
              authUser={authUser}
              socket={socket}
              socketConnected={socketConnected}
              themeMode={themeMode}
              onError={setError}
              onHeaderActionsChange={setChessHeaderActions}
              onNotice={setNotice}
            />
          ) : (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: '420px minmax(0, 1fr)' },
              gap: 2,
              alignItems: 'start',
            }}
          >
          <Card sx={{ width: { xs: '100%', md: 420 }, maxWidth: '100%', justifySelf: 'start' }}>
            <CardContent>
              <Stack
                direction="row"
                sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 2 }}
              >
                <Typography
                  variant="h5"
                  component="h2"
                  sx={{ color: themeMode === 'dark' ? 'text.primary' : '#05070a', fontWeight: 900 }}
                >
                  Channels
                </Typography>
              </Stack>
              <TextField
                label="Filter channels"
                value={channelFilter}
                onChange={(event) => setChannelFilter(event.target.value)}
                size="small"
                fullWidth
                sx={{ mb: 2 }}
                slotProps={{
                  input: {
                    startAdornment: <Search fontSize="small" sx={{ color: 'text.secondary', mr: 1 }} />,
                  },
                }}
              />

              {loadingChannels ? (
                <Stack sx={{ alignItems: 'center', py: 6 }}>
                  <CircularProgress />
                </Stack>
              ) : channels.length === 0 ? (
                <Paper variant="outlined" sx={{ p: 3, textAlign: 'center' }}>
                  <Typography color="text.secondary">No channels yet</Typography>
                </Paper>
              ) : filteredChannels.length === 0 ? (
                <Paper variant="outlined" sx={{ p: 3, textAlign: 'center' }}>
                  <Typography color="text.secondary">No matching channels</Typography>
                </Paper>
              ) : (
                <List disablePadding>
                  {filteredChannels.map((channel) => (
                    <ListItemButton
                      key={channel.id}
                      selected={channel.id === selectedChannelId}
                      onClick={() => setSelectedChannelId(channel.id)}
                      sx={{
                        borderRadius: 1,
                        mb: 0.5,
                        '&.Mui-selected': {
                          bgcolor: themeMode === 'dark' ? 'primary.main' : '#d7ebff',
                          color: themeMode === 'dark' ? 'primary.contrastText' : '#05070a',
                        },
                        '&.Mui-selected .MuiTypography-root': {
                          color: themeMode === 'dark' ? 'primary.contrastText' : '#05070a',
                        },
                        '&.Mui-selected .MuiChip-root': {
                          color: themeMode === 'dark' ? 'primary.contrastText' : '#05070a',
                          borderColor: themeMode === 'dark' ? 'primary.contrastText' : '#05070a',
                        },
                        '&.Mui-selected .channel-list-icon': {
                          color: themeMode === 'dark' ? 'primary.contrastText' : '#05070a',
                        },
                      }}
                    >
                      <ListItemText
                        primary={
                          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                            <Typography sx={{ color: themeMode === 'dark' ? 'text.primary' : '#05070a', fontWeight: 900 }}>
                              #{channel.name}
                            </Typography>
                            <Tooltip title={channel.is_private ? 'Private' : 'Public'}>
                              <Box
                                className="channel-list-icon"
                                component="span"
                                sx={{ color: 'text.secondary', display: 'inline-flex' }}
                              >
                                {channel.is_private ? <Lock fontSize="small" /> : <Public fontSize="small" />}
                              </Box>
                            </Tooltip>
                            {channel.is_read_only && (
                              <Tooltip title="Read only">
                                <Box
                                  className="channel-list-icon"
                                  component="span"
                                  sx={{ color: 'text.secondary', display: 'inline-flex' }}
                                >
                                  <EditOff fontSize="small" />
                                </Box>
                              </Tooltip>
                            )}
                            {channel.request_status === 'pending' && (
                              <Tooltip title="Requested">
                                <Box
                                  className="channel-list-icon"
                                  component="span"
                                  sx={{ color: 'text.secondary', display: 'inline-flex' }}
                                >
                                  <HourglassEmpty fontSize="small" />
                                </Box>
                              </Tooltip>
                            )}
                            {channel.can_manage && channel.pending_request_count > 0 && (
                              <Badge badgeContent={channel.pending_request_count} color="error">
                                <Group fontSize="small" />
                              </Badge>
                            )}
                          </Stack>
                        }
                        secondary={channel.description || 'No description'}
                      />
                      {!channel.can_access && channel.is_private && !channel.request_status && (
                        <Button
                          size="small"
                          variant="outlined"
                          disabled={requestingChannelId === channel.id}
                          onClick={(event) => {
                            event.stopPropagation()
                            handleRequestMembership(channel)
                          }}
                        >
                          Request
                        </Button>
                      )}
                      {channel.can_manage && (
                        <Stack direction="row" spacing={0.5}>
                          <Tooltip title="Members">
                            <IconButton
                              edge="end"
                              size="small"
                              onClick={(event) => {
                                event.stopPropagation()
                                setSelectedChannelId(channel.id)
                                setMembershipDialogOpen(true)
                              }}
                            >
                              <Badge badgeContent={channel.pending_request_count} color="error">
                                <Group fontSize="small" />
                              </Badge>
                            </IconButton>
                          </Tooltip>
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

          <Stack spacing={2}>
            <Card sx={{ height: { md: 'calc(100vh - 145px)' } }}>
              <CardContent
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  height: '100%',
                  minHeight: { xs: 420, md: 0 },
                }}
              >
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
                    <Typography
                      variant="h5"
                      component="h2"
                      sx={{ color: themeMode === 'dark' ? 'text.primary' : '#05070a', fontWeight: 900 }}
                    >
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
                      {canManageSelectedChannel && (
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<Group />}
                          onClick={() => setMembershipDialogOpen(true)}
                        >
                          Members
                        </Button>
                      )}
                      {!canUseSelectedChannel && selectedChannel.is_private && !selectedChannel.request_status && (
                        <Button
                          size="small"
                          variant="contained"
                          disabled={requestingChannelId === selectedChannel.id}
                          onClick={() => handleRequestMembership(selectedChannel)}
                        >
                          Request access
                        </Button>
                      )}
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
                      {selectedChannel.is_read_only && (
                        <Chip
                          label="Read only"
                          color="warning"
                          variant="outlined"
                        />
                      )}
                    </Stack>
                  )}
                </Stack>

                <Divider sx={{ mb: 2 }} />

                <Box sx={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
                {loadingMessages ? (
                  <Stack sx={{ alignItems: 'center', py: 6 }}>
                    <CircularProgress />
                  </Stack>
                ) : !selectedChannel ? (
                  <Typography color="text.secondary">Select a channel</Typography>
                ) : !canUseSelectedChannel ? (
                  <Typography color="text.secondary">
                    Request access to read this private channel
                  </Typography>
                ) : messages.length === 0 ? (
                  <Typography color="text.secondary">No messages in this channel</Typography>
                ) : (
                  <ChannelMessageList
                    authUser={authUser}
                    messages={messages}
                    endRef={messagesEndRef}
                    onDeleteMessage={handleDeleteMessage}
                    onBlockUser={handleBlockUser}
                  />
                )}
                </Box>

                {selectedChannel && canUseSelectedChannel && (
                  <Box
                    component="form"
                    onSubmit={handleSendMessage}
                    sx={{
                      mt: 1.5,
                      pt: 1.5,
                      borderTop: 1,
                      borderColor: 'divider',
                      bgcolor: 'background.paper',
                    }}
                  >
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                      <TextField
                        inputRef={messageInputRef}
                        label={
                          canWriteSelectedChannel
                            ? `Message #${selectedChannel.name}`
                            : 'Read only'
                        }
                        value={draftMessage}
                        onChange={(event) => setDraftMessage(event.target.value)}
                        size="small"
                        fullWidth
                        disabled={!canWriteSelectedChannel}
                      />
                      <Button
                        type="submit"
                        variant="contained"
                        endIcon={<Send />}
                        disabled={
                          !draftMessage.trim() ||
                          sendingMessage ||
                          !socketConnected ||
                          !canWriteSelectedChannel
                        }
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
          </>
        )}
      </Stack>

      <Dialog
        open={channelDialogOpen}
        onClose={closeChannelDialog}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>{editingId ? 'Edit Channel' : 'Create Channel'}</DialogTitle>
        <Box component="form" id="channel-form" onSubmit={handleSubmit}>
          <DialogContent>
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
              {isAdmin ? (
                <ChannelSettingsToggles form={form} onChange={updateForm} />
              ) : (
                <Alert severity="info">New channels are private</Alert>
              )}
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={closeChannelDialog} disabled={saving}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              startIcon={<Save />}
              disabled={saving}
            >
              {saving ? 'Saving' : editingId ? 'Save' : 'Create'}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      <ChannelMembershipDialog
        open={membershipDialogOpen}
        channel={selectedChannel}
        authUser={authUser}
        authHeaders={authHeaders}
        onClose={() => setMembershipDialogOpen(false)}
        onChanged={loadChannels}
        onError={setError}
        onNotice={setNotice}
      />
    </Container>
  )
}

export default AppContent
