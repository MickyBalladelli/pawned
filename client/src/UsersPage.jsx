import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { AdminPanelSettings, Block, Code, Person, Refresh, Shield } from '@mui/icons-material'
import { requestJson } from './requestJson'

function getInitial(username) {
  return username?.trim().charAt(0).toUpperCase() || '?'
}

function getRole(user) {
  if (user.role) {
    return user.role
  }

  return user.is_admin ? 'admin' : 'user'
}

function roleIcon(role) {
  if (role === 'admin') {
    return <AdminPanelSettings fontSize="small" />
  }

  if (role === 'moderator') {
    return <Shield fontSize="small" />
  }

  if (role === 'developer') {
    return <Code fontSize="small" />
  }

  return <Person fontSize="small" />
}

function roleColor(role) {
  if (role === 'admin') {
    return 'error'
  }

  if (role === 'moderator') {
    return 'warning'
  }

  if (role === 'developer') {
    return 'success'
  }

  return 'default'
}

function UsersPage({ authToken, authUser, onError, onNotice }) {
  const [users, setUsers] = useState([])
  const [filter, setFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)
  const [localError, setLocalError] = useState(null)

  const authHeaders = useMemo(
    () => (authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    [authToken],
  )

  const loadUsers = useCallback(async () => {
    setLoading(true)
    setLocalError(null)

    try {
      const data = await requestJson('/api/users', {
        headers: authHeaders,
      })
      setUsers(data)
    } catch (err) {
      setLocalError(err.message)
      onError(err.message)
    } finally {
      setLoading(false)
    }
  }, [authHeaders, onError])

  useEffect(() => {
    const load = Promise.resolve().then(() => loadUsers())
    return () => {
      load.catch(() => {})
    }
  }, [loadUsers])

  const filteredUsers = useMemo(() => {
    const query = filter.trim().toLowerCase()

    if (!query) {
      return users
    }

    return users.filter((user) => {
      return (
        user.username?.toLowerCase().includes(query) ||
        user.email?.toLowerCase().includes(query) ||
        getRole(user).includes(query)
      )
    })
  }, [filter, users])

  async function updateUserRole(user, role) {
    setBusyId(user.id)
    setLocalError(null)

    try {
      const data = await requestJson(`/api/users/${user.id}/role`, {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({ role }),
      })
      setUsers((current) => current.map((item) => (item.id === user.id ? data.user : item)))
      onNotice(data.message)
    } catch (err) {
      setLocalError(err.message)
      onError(err.message)
    } finally {
      setBusyId(null)
    }
  }

  async function updateUserBlock(user, blocked) {
    setBusyId(user.id)
    setLocalError(null)

    try {
      const data = await requestJson(`/api/users/${user.id}/block`, {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({ blocked }),
      })
      setUsers((current) => current.map((item) => (item.id === user.id ? data.user : item)))
      onNotice(data.message)
    } catch (err) {
      setLocalError(err.message)
      onError(err.message)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <Stack spacing={2}>
      {localError && (
        <Alert severity="error" onClose={() => setLocalError(null)}>
          {localError}
        </Alert>
      )}

      <Card>
        <CardContent>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1}
            sx={{ alignItems: { xs: 'stretch', sm: 'center' }, mb: 2 }}
          >
            <TextField
              label="Find user"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              size="small"
              sx={{ maxWidth: { sm: 360 } }}
              fullWidth
            />
            <Box sx={{ flex: 1 }} />
            <Button
              variant="outlined"
              startIcon={<Refresh />}
              onClick={loadUsers}
              disabled={loading}
            >
              Refresh
            </Button>
          </Stack>

          {loading ? (
            <Stack sx={{ alignItems: 'center', py: 6 }}>
              <CircularProgress />
            </Stack>
          ) : filteredUsers.length === 0 ? (
            <Paper variant="outlined" sx={{ p: 3, textAlign: 'center' }}>
              <Typography color="text.secondary">No users</Typography>
            </Paper>
          ) : (
            <Stack spacing={1}>
              {filteredUsers.map((user) => {
                const role = getRole(user)
                const isSelf = Number(user.id) === Number(authUser.id)

                return (
                  <Paper key={user.id} variant="outlined" sx={{ p: 1.25 }}>
                    <Stack
                      direction={{ xs: 'column', md: 'row' }}
                      spacing={1.25}
                      sx={{ alignItems: { xs: 'stretch', md: 'center' } }}
                    >
                      <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center', minWidth: 0, flex: 1 }}>
                        <Avatar
                          src={user.avatar_url || undefined}
                          sx={{ width: 40, height: 40, fontWeight: 900, bgcolor: 'primary.main' }}
                        >
                          {getInitial(user.username)}
                        </Avatar>
                        <Box sx={{ minWidth: 0 }}>
                          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                            <Typography sx={{ fontWeight: 900 }}>{user.username}</Typography>
                            <Chip
                              size="small"
                              icon={roleIcon(role)}
                              label={role}
                              color={roleColor(role)}
                              variant={role === 'user' ? 'outlined' : 'filled'}
                            />
                            {user.is_blocked && (
                              <Chip size="small" icon={<Block />} label="blocked" color="error" variant="outlined" />
                            )}
                          </Stack>
                          <Typography variant="body2" color="text.secondary" noWrap>
                            {user.email || 'No email'}
                          </Typography>
                        </Box>
                      </Stack>

                      <TextField
                        select
                        size="small"
                        label="Role"
                        value={role}
                        disabled={busyId === user.id || isSelf}
                        onChange={(event) => updateUserRole(user, event.target.value)}
                        sx={{ minWidth: 170 }}
                      >
                        <MenuItem value="user">User</MenuItem>
                        <MenuItem value="developer">Developer</MenuItem>
                        <MenuItem value="moderator">Moderator</MenuItem>
                        <MenuItem value="admin">Admin</MenuItem>
                      </TextField>

                      <Button
                        variant={user.is_blocked ? 'contained' : 'outlined'}
                        color={user.is_blocked ? 'success' : 'error'}
                        startIcon={<Block />}
                        disabled={busyId === user.id || isSelf}
                        onClick={() => updateUserBlock(user, !user.is_blocked)}
                        sx={{ minWidth: 130 }}
                      >
                        {user.is_blocked ? 'Unblock' : 'Block'}
                      </Button>
                    </Stack>
                  </Paper>
                )
              })}
            </Stack>
          )}
        </CardContent>
      </Card>
    </Stack>
  )
}

export default UsersPage
