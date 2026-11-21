import { handle } from '../_lib/api.js'

export const onRequest = ({ request, env }) => handle(request, env)
