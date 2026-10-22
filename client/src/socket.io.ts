import { io, type Socket } from 'socket.io-client'

let socket: Socket | undefined

export const useSocketIO = () => {
  socket ??= io({ withCredentials: true })
  return { socket }
}

export function disconnectSocketIO() {
  if (!socket) return
  socket.auth = {}
  socket.disconnect()
  socket.removeAllListeners()
  socket = undefined
}
