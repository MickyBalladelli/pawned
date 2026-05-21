import { useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { Lock } from '@mui/icons-material'

function LoginPage({ authenticating, error, onClearError, onLogin }) {
  const [authForm, setAuthForm] = useState({ username: '', password: '' })

  async function handleSubmit(event) {
    event.preventDefault()
    await onLogin(authForm)
  }

  return (
    <Container maxWidth="sm" sx={{ py: { xs: 4, md: 8 } }}>
      <Stack spacing={3}>
        <Box
          component="img"
          src="/images/vela.png"
          alt="Vela"
          sx={{
            width: '100%',
            maxHeight: 220,
            objectFit: 'cover',
            borderRadius: 2,
          }}
        />

        <Card>
          <CardContent component="form" onSubmit={handleSubmit}>
            <Stack spacing={2.5}>
              <Box sx={{ textAlign: 'left' }}>
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1 }}>
                  <Lock color="primary" />
                  <Typography variant="overline" color="text.secondary">
                    Sign in
                  </Typography>
                </Stack>
                <Typography variant="h4" component="h1" sx={{ fontWeight: 700 }}>
                  Vela Login
                </Typography>
              </Box>

              {error && (
                <Alert severity="error" onClose={onClearError}>
                  {error}
                </Alert>
              )}

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
      </Stack>
    </Container>
  )
}

export default LoginPage
