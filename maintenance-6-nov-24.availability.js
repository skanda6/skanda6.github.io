// maintenance-6-nov-24.availability.js
// Helps load availability.json and update it via GitHub Contents API from the browser.
// Usage: include in maintenance-6-nov-24.html with
// <script src="/maintenance-6-nov-24.availability.js"></script>

(function () {
  // Helper: collect checked items grouped by category (name without [] suffix)
  function collectAvailability() {
    const data = {};
    document.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      if (!cb.name) return;
      const cat = cb.name.replace(/\[\]$/, '');
      if (!data[cat]) data[cat] = [];
      if (cb.checked) data[cat].push(cb.value);
    });
    return data;
  }

  // Load availability.json and pre-check matching checkboxes
  async function loadAvailability() {
    try {
      const res = await fetch('/availability.json', {cache: 'no-store'});
      if (!res.ok) return;
      const avail = await res.json();
      // For each category array, check matching checkboxes
      Object.keys(avail).forEach(cat => {
        const values = avail[cat] || [];
        document.querySelectorAll('input[name="'+cat+'[]"]').forEach(cb => {
          cb.checked = values.includes(cb.value);
        });
      });
    } catch (e) {
      console.error('Could not load availability.json', e);
    }
  }

  // Update availability.json on GitHub using the Contents API (PUT). Asks user for PAT.
  async function saveAvailabilityToGitHub() {
    const avail = collectAvailability();
    // Ask user for a PAT with repo:contents (or repo) scope
    const token = prompt('Enter a GitHub Personal Access Token to update availability.json (will be used only for this request):');
    if (!token) {
      alert('No token provided — update cancelled.');
      return;
    }
    // Build content
    const contentText = JSON.stringify(avail, null, 2);
    const contentBase64 = btoa(unescape(encodeURIComponent(contentText)));
    // We need the current file sha to update; fetch current metadata
    const owner = 'skanda6';
    const repo = 'skanda6.github.io';
    const path = 'availability.json';
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`;

    try {
      // Get current file info to obtain sha
      const metaRes = await fetch(apiUrl, {
        headers: { Authorization: 'token ' + token, Accept: 'application/vnd.github.v3+json' }
      });
      if (!metaRes.ok) {
        const msg = await metaRes.text();
        throw new Error('Failed to fetch file metadata: ' + metaRes.status + ' ' + msg);
      }
      const meta = await metaRes.json();
      const currentSha = meta.sha;

      // Now PUT (update)
      const putRes = await fetch(apiUrl, {
        method: 'PUT',
        headers: {
          Authorization: 'token ' + token,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: 'Update availability.json via maintenance page',
          content: contentBase64,
          sha: currentSha,
          branch: 'main'
        })
      });

      const putJson = await putRes.json();
      if (putRes.ok) {
        alert('Availability updated successfully (commit: ' + (putJson.commit && putJson.commit.sha ? putJson.commit.sha : 'unknown') + ').');
        // Optionally refresh the page or re-load availability
        await loadAvailability();
      } else {
        console.error('GitHub API error', putJson);
        alert('Failed to update availability.json: ' + (putJson.message || JSON.stringify(putJson)));
      }
    } catch (err) {
      console.error(err);
      alert('Error updating availability.json: ' + err.message);
    }
  }

  // Hook the form submit: prevent default, call save routine
  document.addEventListener('DOMContentLoaded', function () {
    loadAvailability();
    const form = document.getElementById('staticrypt-form');
    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        // Confirm before sending
        if (!confirm('Save checked items as available (this will update availability.json in the repo)?')) return;
        saveAvailabilityToGitHub();
      });
    }
  });
})();
