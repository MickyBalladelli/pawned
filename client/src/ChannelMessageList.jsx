import { Avatar, Box, Stack, Tooltip, Typography } from '@mui/material'

const groupWindowMs = 5 * 60 * 1000

function formatMessageTime(value) {
  if (!value) {
    return 'Unknown'
  }

  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

function formatFullTime(value) {
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

function shouldShowHeader(message, previousMessage) {
  if (!previousMessage) {
    return true
  }

  if (message.username !== previousMessage.username) {
    return true
  }

  const messageDate = new Date(message.created_at).getTime()
  const previousDate = new Date(previousMessage.created_at).getTime()

  if (Number.isNaN(messageDate) || Number.isNaN(previousDate)) {
    return true
  }

  return messageDate - previousDate > groupWindowMs
}

function ChannelMessageList({ messages, endRef }) {
  return (
    <Box
      sx={{
        maxHeight: { xs: 360, md: 460 },
        overflowY: 'auto',
        pr: 0.5,
        mx: -1,
      }}
    >
      {messages.map((message, index) => {
        const hasHeader = shouldShowHeader(message, messages[index - 1])

        return (
          <Box
            key={message.id}
            sx={{
              display: 'grid',
              gridTemplateColumns: '40px minmax(0, 1fr)',
              columnGap: 1.25,
              px: 1,
              pt: hasHeader ? 1.25 : 0.125,
              pb: 0.125,
              textAlign: 'left',
              '&:hover': {
                bgcolor: 'action.hover',
              },
              '&:hover .message-time': {
                opacity: 1,
              },
            }}
          >
            {hasHeader ? (
              <Avatar
                src={message.avatar_url || undefined}
                sx={{
                  width: 32,
                  height: 32,
                  mt: 0.25,
                  fontSize: 14,
                  fontWeight: 800,
                  bgcolor: 'primary.main',
                }}
              >
                {getInitial(message.username)}
              </Avatar>
            ) : (
              <Typography
                className="message-time"
                variant="caption"
                color="text.secondary"
                sx={{
                  opacity: 0,
                  justifySelf: 'end',
                  pt: 0.2,
                  fontSize: 11,
                  lineHeight: '20px',
                }}
              >
                {formatMessageTime(message.created_at)}
              </Typography>
            )}

            <Box sx={{ minWidth: 0 }}>
              {hasHeader && (
                <Stack
                  direction="row"
                  spacing={1}
                  sx={{ alignItems: 'baseline', minWidth: 0, mb: 0.125 }}
                >
                  <Typography
                    component="span"
                    sx={{
                      fontSize: 14,
                      fontWeight: 800,
                      lineHeight: 1.25,
                      color: 'text.primary',
                    }}
                  >
                    {message.username}
                  </Typography>
                  <Tooltip title={formatFullTime(message.created_at)}>
                    <Typography
                      component="span"
                      color="text.secondary"
                      sx={{ fontSize: 11.5, lineHeight: 1.25 }}
                    >
                      {formatMessageTime(message.created_at)}
                    </Typography>
                  </Tooltip>
                </Stack>
              )}
              <Typography
                sx={{
                  whiteSpace: 'pre-wrap',
                  overflowWrap: 'anywhere',
                  fontSize: 14,
                  lineHeight: 1.35,
                  color: 'text.primary',
                }}
              >
                {message.content}
              </Typography>
            </Box>
          </Box>
        )
      })}
      <Box ref={endRef} />
    </Box>
  )
}

export default ChannelMessageList
