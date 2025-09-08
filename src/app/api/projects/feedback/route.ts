import { NextRequest, NextResponse } from 'next/server';
import { Client } from '@microsoft/microsoft-graph-client';
import { ClientSecretCredential } from '@azure/identity';

async function getGraphClient() {
  const credential = new ClientSecretCredential(
    process.env.AZURE_TENANT_ID as string,
    process.env.AZURE_CLIENT_ID as string,
    process.env.AZURE_CLIENT_SECRET as string
  );
  const token = await credential.getToken('https://graph.microsoft.com/.default');
  if (!token?.token) throw new Error('Failed to acquire Graph token');
  return Client.init({ authProvider: (done) => done(null, token.token) });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId');
  const voiceTitle = searchParams.get('voiceTitle');
  
  if (!projectId) {
    return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
  }

  try {
    const client = await getGraphClient();
    const site = await client.api('/sites/adamass.sharepoint.com:/sites/VoxStudiosplatform').get();
    const drives = await client.api(`/sites/${site.id}/drives`).get();
    const driveId = drives?.value?.[0]?.id;
    if (!driveId) return NextResponse.json({ error: 'No document library found on site' }, { status: 500 });

    // Get all feedback files for the project
    const folderPath = `/sites/${site.id}/drives/${driveId}/root:/${encodeURIComponent(projectId)}/stage3/feedback`;
    
    try {
      const children = await client
        .api(`${folderPath}:/children`)
        .select('name,size,webUrl,file')
        .top(999)
        .get();
      
      const feedbackFiles = (children.value || [])
        .filter((item: any) => !!item.file && item.name.startsWith('feedback_'))
        .map((item: any) => ({ name: item.name, size: item.size, webUrl: item.webUrl }));

      // If voiceTitle is specified, filter files for that voice
      let relevantFiles = feedbackFiles;
      if (voiceTitle) {
        const voiceName = voiceTitle.replace(/\s+/g, '_');
        const voiceNameSpaces = voiceTitle.replace(/\s+/g, ' ');
        console.log('Filtering files for voice:', voiceTitle);
        console.log('Voice name variants:', { voiceName, voiceNameSpaces });
        console.log('All feedback files:', feedbackFiles.map((f: any) => f.name));
        
        relevantFiles = feedbackFiles.filter((file: any) => {
          const matches = file.name.includes(voiceName) || 
                         file.name.includes(encodeURIComponent(voiceTitle)) ||
                         file.name.includes(voiceNameSpaces) ||
                         file.name.toLowerCase().includes(voiceTitle.toLowerCase());
          console.log(`File ${file.name} matches voice ${voiceTitle}:`, matches);
          return matches;
        });
        
        console.log('Relevant files after filtering:', relevantFiles.map((f: any) => f.name));
      }

      // Get the most recent feedback file for the voice
      if (relevantFiles.length === 0) {
        return NextResponse.json({ success: true, feedback: [] });
      }

      // Sort by name (which includes date) and get the most recent
      const latestFile = relevantFiles.sort((a: any, b: any) => b.name.localeCompare(a.name))[0];
      
      // Download and parse the feedback file
      console.log('Loading feedback file:', latestFile.name);
      const fileContent = await client.api(`${folderPath}/${latestFile.name}:/content`).get();
      
      let content: string;
      if (typeof fileContent === 'string') {
        content = fileContent;
      } else if (fileContent instanceof ArrayBuffer) {
        content = new TextDecoder().decode(fileContent);
      } else if (fileContent instanceof Uint8Array) {
        content = new TextDecoder().decode(fileContent);
      } else {
        content = JSON.stringify(fileContent);
      }
      
      // Parse the feedback content
      const feedback = parseFeedbackContent(content);
      console.log('Parsed feedback:', feedback);
      
      return NextResponse.json({ success: true, feedback });
    } catch (error) {
      console.error('Error loading feedback files:', error);
      return NextResponse.json({ success: true, feedback: [] });
    }
  } catch (error) {
    console.error('Error in feedback API:', error);
    return NextResponse.json({ error: 'Failed to load feedback' }, { status: 500 });
  }
}

function parseFeedbackContent(content: string) {
  const feedback: Array<{ id: string; timestamp: number; comment: string; resolved: boolean }> = [];
  
  try {
    console.log('Parsing content:', content);
    const lines = content.split('\n');
    let inFeedbackSection = false;
    
    for (const line of lines) {
      console.log('Processing line:', line);
      if (line.includes('Feedback Comments:')) {
        inFeedbackSection = true;
        console.log('Found feedback section');
        continue;
      }
      
      if (inFeedbackSection && line.trim()) {
        // Parse lines like: [00:15] This is a comment (Resolved) or (Pending)
        const match = line.match(/^\[(\d{1,2}:\d{2})\]\s*(.+?)\s*(\(Resolved\)|\(Pending\))?$/);
        if (match) {
          const [, timeStr, comment, status] = match;
          const timestamp = parseTimeToSeconds(timeStr);
          const resolved = status === '(Resolved)';
          
          console.log('Parsed feedback item:', { timeStr, comment, status, timestamp, resolved });
          
          feedback.push({
            id: `${timestamp}_${Date.now()}_${Math.random()}`,
            timestamp,
            comment: comment.trim(),
            resolved
          });
        } else {
          console.log('Line did not match feedback pattern:', line);
        }
      }
    }
  } catch (error) {
    console.error('Error parsing feedback content:', error);
  }
  
  console.log('Final parsed feedback:', feedback);
  return feedback;
}

function parseTimeToSeconds(timeStr: string): number {
  const [minutes, seconds] = timeStr.split(':').map(Number);
  return minutes * 60 + seconds;
}
