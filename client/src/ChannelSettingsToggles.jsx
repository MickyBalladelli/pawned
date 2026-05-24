import {
  Box,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material'
import { Lock, Public, Visibility } from '@mui/icons-material'

function ChannelSettingsToggles({ form, onChange }) {
  return (
    <Stack spacing={1.5}>
      <Box>
        <Typography variant="caption" color="text.secondary">
          Visibility
        </Typography>
        <ToggleButtonGroup
          color="primary"
          exclusive
          fullWidth
          size="small"
          value={form.is_private ? 'private' : 'public'}
          onChange={(event, value) => {
            if (value) {
              onChange('is_private', value === 'private')
            }
          }}
        >
          <ToggleButton value="public">
            <Public fontSize="small" />
            Public
          </ToggleButton>
          <ToggleButton value="private">
            <Lock fontSize="small" />
            Private
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      <Box>
        <Typography variant="caption" color="text.secondary">
          Read only
        </Typography>
        <ToggleButton
          color="warning"
          fullWidth
          selected={form.is_read_only}
          size="small"
          value="read_only"
          onChange={() => onChange('is_read_only', !form.is_read_only)}
        >
          <Visibility fontSize="small" />
          {form.is_read_only ? 'Read only on' : 'Read only off'}
        </ToggleButton>
      </Box>
    </Stack>
  )
}

export default ChannelSettingsToggles
