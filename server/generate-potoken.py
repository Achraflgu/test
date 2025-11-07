#!/usr/bin/env python3
"""
PO Token Generator using pytubefix
Generates YouTube PO tokens for bypassing bot detection
"""
import sys
import json

try:
    from pytubefix import YouTube
except ImportError:
    print(json.dumps({
        'success': False,
        'error': 'pytubefix not installed. Run: pip install pytubefix',
        'error_type': 'ImportError'
    }))
    sys.exit(1)

def generate_po_token(video_url='https://www.youtube.com/watch?v=jNQXAC9IVRw'):
    """
    Generate PO token for a YouTube video URL
    
    Args:
        video_url: YouTube video URL to use for token generation
        
    Returns:
        JSON with po_token, visitor_data, and video_id
    """
    try:
        # Initialize YouTube object with PO token support
        yt = YouTube(video_url, use_po_token=True)
        
        # Access video properties to trigger token generation
        try:
            title = yt.title  # This triggers the API call
        except Exception as e:
            # Even if title fetch fails, we might have gotten a token
            pass
        
        # Extract tokens (these are set during the YouTube API call)
        po_token = getattr(yt, 'po_token', None)
        visitor_data = getattr(yt, 'visitor_data', None)
        
        # Check if we got a valid token
        if po_token:
            result = {
                'success': True,
                'po_token': po_token,
                'visitor_data': visitor_data,
                'video_id': yt.video_id
            }
        else:
            result = {
                'success': False,
                'error': 'No PO token generated',
                'error_type': 'TokenGenerationFailed',
                'visitor_data': visitor_data,
                'video_id': yt.video_id
            }
        
        print(json.dumps(result))
        return result
        
    except Exception as e:
        error_result = {
            'success': False,
            'error': str(e),
            'error_type': type(e).__name__
        }
        print(json.dumps(error_result))
        sys.exit(1)

if __name__ == '__main__':
    # Get video URL from command line argument or use default
    video_url = sys.argv[1] if len(sys.argv) > 1 else 'https://www.youtube.com/watch?v=jNQXAC9IVRw'
    generate_po_token(video_url)

