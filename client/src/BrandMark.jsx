import { Box, Stack, Typography } from '@mui/material'
import packageInfo from '../package.json'

function BrandMark() {
  return (
    <Stack
      direction="row"
      spacing={1}
      sx={{
        alignItems: 'center',
        minWidth: { xs: '100%', sm: 190, md: 166 },
      }}
    >
      <Box
        component="img"
        src="/images/pawned.png"
        alt="Pawned"
        sx={{
          width: { xs: 82, sm: 82, md: 72 },
          height: { xs: 82, sm: 72, md: 64 },
          objectFit: 'contain',
          borderRadius: 2,
          flex: '0 0 auto',
        }}
      />
      <Box sx={{ minWidth: 0 }}>
        <Typography
          component="div"
          sx={{
            color: 'text.primary',
            fontFamily: 'Georgia, Cambria, Times New Roman, serif',
            fontSize: { xs: 26, md: 29 },
            fontWeight: 800,
            lineHeight: 0.95,
            letterSpacing: 0,
            fontStyle: 'italic',
          }}
        >
          Pawned
        </Typography>
        <Typography
          component="div"
          sx={{
            color: 'text.secondary',
            fontSize: 12,
            fontWeight: 700,
            lineHeight: 1.2,
            mt: 0.5,
          }}
        >
          v{packageInfo.version}
        </Typography>
      </Box>
    </Stack>
  )
}

export default BrandMark
