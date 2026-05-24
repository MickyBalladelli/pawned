import { useEffect, useRef, useState } from 'react'
import { Box, Button, Paper, Stack, TextField, Typography } from '@mui/material'
import { Send } from '@mui/icons-material'
import ChannelMessageList from './ChannelMessageList'
import { requestJson } from './requestJson'

function ChessGameChat({ authHeaders, authUser, game, socket, socketConnected, onError, onGameUpdated }) {
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const endRef = useRef(null)
  const channelId = game?.chat_channel_id
  const chatClosed = Boolean(game?.chat_closed_at)

  useEffect(() => {
    if (!channelId) {
      Promise.resolve().then(() => setMessages([]))
      return
    }

    requestJson(`/api/channels/${channelId}/messages?limit=40`, {
      headers: authHeaders,
    }).then((data) => {
      setMessages([...data].reverse())
    }).catch((err) => onError(err.message))
  }, [authHeaders, channelId, onError])

  useEffect(() => {
    if (!socket || !channelId) {
      return undefined
    }

    socket.emit('joinChannel', channelId, (response) => {
      if (response?.error) {
        onError(response.error)
      }
    })

    const handleMessage = (message) => {
      if (Number(message.channel_id) !== Number(channelId)) {
        return
      }

      setMessages((current) => {
        if (current.some((item) => item.id === message.id)) {
          return current
        }

        return [...current, message]
      })
    }
    const handleDeletedMessage = (message) => {
      if (Number(message.channel_id) !== Number(channelId)) {
        return
      }

      setMessages((current) => current.filter((item) => Number(item.id) !== Number(message.id)))
    }

    socket.on('receiveMessage', handleMessage)
    socket.on('messageDeleted', handleDeletedMessage)

    return () => {
      socket.off('receiveMessage', handleMessage)
      socket.off('messageDeleted', handleDeletedMessage)
      socket.emit('leaveChannel', channelId)
    }
  }, [channelId, onError, socket])

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest' })
  }, [messages.length])

  async function sendMessage(event) {
    event.preventDefault()

    if (!draft.trim() || !socket || !socketConnected || chatClosed) {
      return
    }

    setSending(true)
    socket.timeout(5000).emit(
      'sendMessage',
      { channelId, message: draft.trim() },
      (err, response) => {
        setSending(false)

        if (err) {
          onError('Message timed out')
          return
        }

        if (response?.error) {
          onError(response.error)
          return
        }

        setDraft('')
      },
    )
  }

  async function closeChat() {
    try {
      const data = await requestJson(`/api/chess/games/${game.id}/close-chat`, {
        method: 'POST',
        headers: authHeaders,
      })
      onGameUpdated(data.game)
    } catch (err) {
      onError(err.message)
    }
  }

  async function deleteMessage(message) {
    try {
      await requestJson(`/api/messages/${message.id}`, {
        method: 'DELETE',
        headers: authHeaders,
      })
      setMessages((current) => current.filter((item) => item.id !== message.id))
    } catch (err) {
      onError(err.message)
    }
  }

  if (!channelId) {
    return null
  }

  const canClose = !chatClosed && ['checkmate', 'draw', 'resigned', 'canceled'].includes(game.status) && (
    authUser.is_admin || Number(game.creator_user_id) === Number(authUser.id)
  )

  return (
    <Paper variant="outlined" sx={{ p: 0.75 }}>
      {canClose && (
        <Stack direction="row" sx={{ justifyContent: 'flex-end', mb: 0.75 }}>
          <Button size="small" variant="outlined" onClick={closeChat}>
            Close chat
          </Button>
        </Stack>
      )}
      <Box sx={{ height: { xs: 190, lg: 250 }, overflow: 'hidden', mb: 1 }}>
        {messages.length === 0 ? (
          <Typography color="text.secondary">No messages</Typography>
        ) : (
          <ChannelMessageList
            authUser={authUser}
            messages={messages}
            endRef={endRef}
            onDeleteMessage={deleteMessage}
          />
        )}
      </Box>
      <Box component="form" onSubmit={sendMessage}>
        <Stack direction="row" spacing={1}>
          <TextField
            size="small"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            disabled={chatClosed}
            placeholder={chatClosed ? 'Chat closed' : 'Message game chat'}
            fullWidth
          />
          <Button
            type="submit"
            size="small"
            variant="contained"
            endIcon={<Send />}
            disabled={!draft.trim() || sending || !socketConnected || chatClosed}
          >
            Send
          </Button>
        </Stack>
      </Box>
    </Paper>
  )
}

export default ChessGameChat
