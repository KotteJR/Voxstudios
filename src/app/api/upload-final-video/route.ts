import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

export async function POST(req: NextRequest) {
  try {
    // Get the form data
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const projectId = formData.get('projectId') as string;
    const title = formData.get('title') as string;

    if (!file || !projectId || !title) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Create the final-videos directory in public/uploads
    const publicUploadsPath = path.join(process.cwd(), 'public', 'uploads');
    const projectPath = path.join(publicUploadsPath, projectId);
    const finalVideosPath = path.join(projectPath, 'final-videos');
    
    try {
      await mkdir(finalVideosPath, { recursive: true });
    } catch (error) {
      console.error('Error creating directories:', error);
    }

    // Generate file path and URL
    const fileName = `${title}${getFileExtension(file.name)}`;
    const filePath = path.join(finalVideosPath, fileName);
    const publicUrl = `/uploads/${projectId}/final-videos/${encodeURIComponent(fileName)}`;

    // Convert File to Buffer and save it
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    await writeFile(filePath, buffer);

    return NextResponse.json({
      success: true,
      file: {
        name: fileName,
        url: publicUrl
      }
    });

  } catch (error) {
    console.error('Error uploading video:', error);
    return NextResponse.json(
      { error: 'Failed to upload video' },
      { status: 500 }
    );
  }
}

function getFileExtension(filename: string): string {
  const ext = filename.split('.').pop();
  return ext ? `.${ext}` : '';
} 