document.getElementById('login-btn').addEventListener('click', () => {
    window.location.href = '/login';
  });
  
  document.getElementById('sync-btn').addEventListener('click', async () => {
    const track_uri = document.getElementById('track-uri').value.trim();
  
    if (!track_uri || !track_uri.startsWith('spotify:track:')) {
      alert('Please enter a valid Spotify Track URI (e.g., spotify:track:1301WleyT98MSxVHPZCA6M)');
      return;
    }
  
    try {
      const response = await fetch('/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uris: [track_uri], 
          position_ms: 0,
        }),
      });
  
      if (response.ok) {
        alert('Playback synced successfully!');
      } else {
        const errorData = await response.json();
        alert(`Failed to sync playback: ${errorData.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error(error);
      alert('An error occurred. Please try again.');
    }
  });