declare module 'streamifier' {
  import { Readable } from 'stream'
  
  interface Streamifier {
    createReadStream(buffer: Buffer | string, options?: any): Readable
  }
  
  const streamifier: Streamifier
  export default streamifier
}
