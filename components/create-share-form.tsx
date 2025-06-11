"use client";

import React, { useState, FormEvent } from 'react';

const periodOptions = [
  { value: '7day', label: 'Last 7 Days' },
  { value: '1month', label: 'Last 1 Month' },
  { value: '3month', label: 'Last 3 Months' },
  { value: '6month', label: 'Last 6 Months' },
  { value: '12month', label: 'Last 12 Months' },
  { value: 'overall', label: 'Overall' },
];

const CreateShareForm: React.FC = () => {
  const [username, setUsername] = useState('');
  const [period, setPeriod] = useState(periodOptions[0].value); // Default to '7day'
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successLink, setSuccessLink] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccessLink(null);

    // Basic validation
    if (!username.trim() || !title.trim()) {
      setError('Username and Title are required.');
      setIsLoading(false);
      return;
    }
    if (!period) {
        setError('Please select a period.');
        setIsLoading(false);
        return;
    }

    try {
      const response = await fetch('/api/share', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, period, title, description }),
      });

      const responseData = await response.json();

      if (response.ok && response.status === 201) {
        setSuccessLink(`/share/${responseData.collectionId}`);
        // Optionally reset form fields
        // setUsername('');
        // setPeriod(periodOptions[0].value);
        // setTitle('');
        // setDescription('');
      } else {
        setError(responseData.error || 'Failed to create shared collection. Please try again.');
      }
    } catch (e) {
      console.error("Create share error:", e);
      setError('An unexpected error occurred. Please check your network and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Basic styling for form elements
  const inputStyle = {
    display: 'block',
    width: '100%',
    padding: '8px',
    marginBottom: '10px',
    border: '1px solid #ccc',
    borderRadius: '4px',
    boxSizing: 'border-box' as const,
  };
  const labelStyle = {
    display: 'block',
    marginBottom: '5px',
    fontWeight: 'bold',
  };
   const buttonStyle = {
    padding: '10px 15px',
    backgroundColor: isLoading ? '#ccc' : '#007bff',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: isLoading ? 'not-allowed' : 'pointer',
  };


  return (
    <div style={{ maxWidth: '500px', margin: '20px auto', padding: '20px', border: '1px solid #eee', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="username" style={labelStyle}>Last.fm Username:</label>
          <input
            type="text"
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            style={inputStyle}
            disabled={isLoading}
          />
        </div>

        <div>
          <label htmlFor="period" style={labelStyle}>Period:</label>
          <select
            id="period"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            required
            style={inputStyle}
            disabled={isLoading}
          >
            {periodOptions.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="title" style={labelStyle}>Collection Title:</label>
          <input
            type="text"
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            style={inputStyle}
            disabled={isLoading}
          />
        </div>

        <div>
          <label htmlFor="description" style={labelStyle}>Description (Optional):</label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            style={inputStyle}
            disabled={isLoading}
          />
        </div>

        <button type="submit" disabled={isLoading} style={buttonStyle}>
          {isLoading ? 'Creating...' : 'Create Share Link'}
        </button>
      </form>

      {successLink && (
        <div style={{ marginTop: '20px', padding: '10px', backgroundColor: '#d4edda', color: '#155724', borderRadius: '4px' }}>
          <p>Success! Share this link:</p>
          <a href={successLink} target="_blank" rel="noopener noreferrer" style={{ color: '#007bff', textDecoration: 'underline' }}>
            {`${window.location.origin}${successLink}`}
          </a>
        </div>
      )}

      {error && (
        <div style={{ marginTop: '20px', padding: '10px', backgroundColor: '#f8d7da', color: '#721c24', borderRadius: '4px' }}>
          <p>Error: {error}</p>
        </div>
      )}
    </div>
  );
};

export default CreateShareForm;
