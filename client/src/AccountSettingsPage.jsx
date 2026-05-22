import { useRef, useState } from 'react'
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  FormControlLabel,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material'
import { ArrowBack, PhotoCamera, Save } from '@mui/icons-material'
import PasswordField from './PasswordField'
import { requestJson } from './requestJson'

function getInitial(username) {
  return username?.trim().charAt(0).toUpperCase() || '?'
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('Failed to read picture'))
    reader.readAsDataURL(file)
  })
}

function AccountSettingsPage({ authToken, user, onBack, onUserUpdated }) {
  const fileInputRef = useRef(null)
  const [form, setForm] = useState({
    email: user.email || '',
    currentPassword: '',
    newPassword: '',
    confirmNewPassword: '',
    avatarUrl: user.avatar_url || '',
    showChannelPresence: user.show_channel_presence !== false,
  })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)
  const [error, setError] = useState(null)

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
    setError(null)
    setMessage(null)
  }

  async function handlePictureChange(event) {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    if (!file.type.startsWith('image/')) {
      setError('Choose an image file')
      return
    }

    if (file.size > 1100000) {
      setError('Picture must be under 1 MB')
      return
    }

    try {
      const avatarUrl = await readFileAsDataUrl(file)
      updateField('avatarUrl', avatarUrl)
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()

    if (form.newPassword !== form.confirmNewPassword) {
      setError('New passwords do not match')
      return
    }

    setSaving(true)
    setError(null)
    setMessage(null)

    try {
      const data = await requestJson('/api/auth/settings', {
        method: 'PUT',
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
        body: JSON.stringify(form),
      })

      setForm((current) => ({
        ...current,
        currentPassword: '',
        newPassword: '',
        confirmNewPassword: '',
      }))
      setMessage(data.message)
      onUserUpdated(data.user)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardContent component="form" onSubmit={handleSubmit}>
        <Stack spacing={3}>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={2}
            sx={{ alignItems: { xs: 'flex-start', sm: 'center' }, justifyContent: 'space-between' }}
          >
            <Box>
              <Typography variant="h4" component="h1" sx={{ fontWeight: 700 }}>
                Settings
              </Typography>
              <Typography color="text.secondary">{user.username}</Typography>
            </Box>
            <Button type="button" variant="outlined" startIcon={<ArrowBack />} onClick={onBack}>
              Back
            </Button>
          </Stack>

          {error && <Alert severity="error">{error}</Alert>}
          {message && <Alert severity="success">{message}</Alert>}

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ alignItems: 'center' }}>
            <Avatar
              src={form.avatarUrl || undefined}
              sx={{ width: 88, height: 88, fontSize: 32, fontWeight: 800, bgcolor: 'primary.main' }}
            >
              {getInitial(user.username)}
            </Avatar>
            <Stack direction="row" spacing={1}>
              <Button
                type="button"
                variant="outlined"
                startIcon={<PhotoCamera />}
                onClick={() => fileInputRef.current?.click()}
              >
                Picture
              </Button>
              {form.avatarUrl && (
                <Button type="button" variant="text" onClick={() => updateField('avatarUrl', '')}>
                  Remove
                </Button>
              )}
            </Stack>
            <Box
              component="input"
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={handlePictureChange}
              sx={{ display: 'none' }}
            />
          </Stack>

          <TextField
            label="Email"
            type="email"
            value={form.email}
            onChange={(event) => updateField('email', event.target.value)}
            size="small"
            fullWidth
            required
          />

          <FormControlLabel
            control={
              <Switch
                checked={form.showChannelPresence}
                onChange={(event) => updateField('showChannelPresence', event.target.checked)}
              />
            }
            label="Show join and leave notices"
          />

          <Stack spacing={2.75}>
            <PasswordField
              label="Current password"
              value={form.currentPassword}
              onChange={(event) => updateField('currentPassword', event.target.value)}
              size="small"
              fullWidth
            />
            <Stack spacing={1.5}>
              <PasswordField
                label="New password"
                value={form.newPassword}
                onChange={(event) => updateField('newPassword', event.target.value)}
                helperText="Leave empty to keep password"
                fullWidth
              />
              <PasswordField
                label="Confirm new password"
                value={form.confirmNewPassword}
                onChange={(event) => updateField('confirmNewPassword', event.target.value)}
                error={Boolean(form.confirmNewPassword) && form.newPassword !== form.confirmNewPassword}
                helperText={
                  Boolean(form.confirmNewPassword) && form.newPassword !== form.confirmNewPassword
                    ? 'Passwords do not match'
                    : ' '
                }
                fullWidth
              />
            </Stack>
          </Stack>

          <Button type="submit" variant="contained" startIcon={<Save />} disabled={saving}>
            {saving ? 'Saving' : 'Save settings'}
          </Button>
        </Stack>
      </CardContent>
    </Card>
  )
}

export default AccountSettingsPage
