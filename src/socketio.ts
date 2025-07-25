import { Server } from 'http'
import * as SocketIo from 'socket.io'

export default (expressServer: Server) => {
  const io = new SocketIo.Server(expressServer, {
    cors: {
      origin: [],
      credentials: true,
      methods: ['GET', 'POST'],
    },
    transports: ['websocket'],
    allowEIO3: true,
  })

  // eslint-disable-next-line @typescript-eslint/require-await
  io.on('connection', async (socket) => {
    // await connect(socket.id);

    socket.on('disconnect', async (reason: string) => {
      // logger.info('Disconnecting with reason %s', reason);
      // await disconnect(socket.id);
    })

    socket.on('message', async ({ ...obj }) => {
      //
    })
  })

  return io
}
