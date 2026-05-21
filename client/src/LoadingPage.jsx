import {
  CircularProgress,
  Container,
  Stack,
  Typography,
} from '@mui/material'

function LoadingPage() {
  return (
    <Container maxWidth="sm" sx={{ py: 8 }}>
      <Stack sx={{ alignItems: 'center' }} spacing={2}>
        <CircularProgress />
        <Typography color="text.secondary">Checking login</Typography>
      </Stack>
    </Container>
  )
}

export default LoadingPage
