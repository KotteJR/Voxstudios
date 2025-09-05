import { NextRequest, NextResponse } from 'next/server';
import { readFile, stat as statAsync } from 'fs/promises';
import path from 'path';
import { stat } from 'fs/promises';

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    const filePath = path.join(process.cwd(), 'public', 'uploads', ...params.path);

    // Check if file exists and get its size
    const stats = await statAsync(filePath);
    if (!stats.isFile()) {
      return new NextResponse('Not found', { status: 404 });
    }

    // Determine content type based on file extension
    const ext = path.extname(filePath).toLowerCase();
    let contentType = 'video/mp4'; // default
    switch (ext) {
      case '.webm':
        contentType = 'video/webm';
        break;
      case '.mov':
        contentType = 'video/quicktime';
        break;
      case '.avi':
        contentType = 'video/x-msvideo';
        break;
      // Add more video types as needed
    }

    // Handle HTTP Range requests for streaming
    const range = request.headers.get('range');
    if (range) {
      const match = range.match(/bytes=(\d+)-(\d*)/);
      if (!match) {
        return new NextResponse('Malformed range', { status: 416 });
      }
      const start = parseInt(match[1], 10);
      const end = match[2] ? Math.min(parseInt(match[2], 10), stats.size - 1) : stats.size - 1;
      if (isNaN(start) || isNaN(end) || start > end || start >= stats.size) {
        return new NextResponse('Range Not Satisfiable', { status: 416 });
      }

      const chunk = await readFile(filePath, { encoding: 'binary' });
      const buffer = Buffer.from(chunk, 'binary').subarray(start, end + 1);
      const headers = new Headers();
      headers.set('Content-Range', `bytes ${start}-${end}/${stats.size}`);
      headers.set('Accept-Ranges', 'bytes');
      headers.set('Content-Length', (end - start + 1).toString());
      headers.set('Content-Type', contentType);
      return new NextResponse(buffer, { status: 206, headers });
    }

    // No range header: send full file
    const fileBuffer = await readFile(filePath);
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Length': stats.size.toString(),
        'Accept-Ranges': 'bytes',
      },
    });
  } catch (error) {
    console.error('Error serving video:', error);
    return new NextResponse('Error serving video', { status: 500 });
  }
} 