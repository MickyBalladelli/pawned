import {
  Box,
  Card,
  CardContent,
  Container,
} from '@mui/material'

function AuthSplitPage({ children, topAction }) {
  return (
    <Container maxWidth="md" sx={{ py: { xs: 4, md: 8 }, position: 'relative' }}>
      {topAction && (
        <Box
          sx={{
            position: { xs: 'static', sm: 'absolute' },
            top: { sm: 18 },
            left: { sm: 24 },
            mb: { xs: 2, sm: 0 },
          }}
        >
          {topAction}
        </Box>
      )}

      <Card>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'minmax(260px, 0.9fr) minmax(340px, 1fr)' },
          }}
        >
          <Box
            sx={{
              p: { xs: 3, md: 4 },
              borderRight: { md: 1 },
              borderBottom: { xs: 1, md: 0 },
              borderColor: 'divider',
              bgcolor: 'background.paper',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Box
              component="img"
              src="/images/pawned.png"
              alt="Pawned"
              sx={{
                width: '100%',
                maxHeight: { xs: 220, md: 360 },
                aspectRatio: '591 / 567',
                objectFit: 'contain',
                borderRadius: 2,
              }}
            />
          </Box>
          <CardContent sx={{ p: { xs: 3, md: 4 } }}>
            {children}
          </CardContent>
        </Box>
      </Card>
    </Container>
  )
}

export default AuthSplitPage
