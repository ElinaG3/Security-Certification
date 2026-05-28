import React, { useState } from 'react';
import SecurityPlusPrep from './components/SecurityPlusPrep';
import SecurityPlusLearning from './components/SecurityPlusLearning';

export default function App() {
  const [currentApp, setCurrentApp] = useState('menu'); // 'menu', 'learning', 'practice'

  if (currentApp === 'learning') {
    return (
      <div>
        <button
          onClick={() => setCurrentApp('menu')}
          style={{
            position: 'fixed',
            top: '20px',
            left: '20px',
            padding: '10px 20px',
            background: '#2c3e50',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            zIndex: 1000,
            fontWeight: 'bold'
          }}
        >
          ← Menu
        </button>
        <SecurityPlusLearning />
      </div>
    );
  }

  if (currentApp === 'practice') {
    return (
      <div>
        <button
          onClick={() => setCurrentApp('menu')}
          style={{
            position: 'fixed',
            top: '20px',
            left: '20px',
            padding: '10px 20px',
            background: '#2c3e50',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            zIndex: 1000,
            fontWeight: 'bold'
          }}
        >
          ← Menu
        </button>
        <SecurityPlusPrep />
      </div>
    );
  }

  return (
    <div style={{ padding: '40px', fontFamily: 'system-ui, -apple-system, sans-serif', textAlign: 'center', maxWidth: '800px', margin: '0 auto' }}>
      <h1 style={{ color: '#2c3e50', fontSize: '48px', marginBottom: '20px' }}>🔐 CompTIA Security+ Exam Prep</h1>
      <p style={{ color: '#7f8c8d', fontSize: '18px', marginBottom: '40px', lineHeight: '1.6' }}>
        Complete study system with interactive learning and practice questions. Choose your path:
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginBottom: '40px' }}>
        <button
          onClick={() => setCurrentApp('learning')}
          style={{
            padding: '40px 20px',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '18px',
            fontWeight: 'bold',
            transition: 'transform 0.2s, boxShadow 0.2s',
            boxShadow: '0 4px 15px rgba(0,0,0,0.1)'
          }}
          onMouseEnter={(e) => {
            e.target.style.transform = 'translateY(-5px)';
            e.target.style.boxShadow = '0 8px 25px rgba(0,0,0,0.2)';
          }}
          onMouseLeave={(e) => {
            e.target.style.transform = 'translateY(0)';
            e.target.style.boxShadow = '0 4px 15px rgba(0,0,0,0.1)';
          }}
        >
          <div style={{ fontSize: '48px', marginBottom: '10px' }}>📚</div>
          <div>Learning Path</div>
          <p style={{ fontSize: '14px', marginTop: '10px', opacity: 0.9 }}>
            Understand concepts deeply with visuals & explanations
          </p>
        </button>

        <button
          onClick={() => setCurrentApp('practice')}
          style={{
            padding: '40px 20px',
            background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '18px',
            fontWeight: 'bold',
            transition: 'transform 0.2s, boxShadow 0.2s',
            boxShadow: '0 4px 15px rgba(0,0,0,0.1)'
          }}
          onMouseEnter={(e) => {
            e.target.style.transform = 'translateY(-5px)';
            e.target.style.boxShadow = '0 8px 25px rgba(0,0,0,0.2)';
          }}
          onMouseLeave={(e) => {
            e.target.style.transform = 'translateY(0)';
            e.target.style.boxShadow = '0 4px 15px rgba(0,0,0,0.1)';
          }}
        >
          <div style={{ fontSize: '48px', marginBottom: '10px' }}>❓</div>
          <div>Practice Questions</div>
          <p style={{ fontSize: '14px', marginTop: '10px', opacity: 0.9 }}>
            Test yourself with 135+ exam-style questions + goal tracking
          </p>
        </button>
      </div>

      <div style={{ background: '#e8f4f8', padding: '20px', borderRadius: '8px', textAlign: 'left' }}>
        <h3 style={{ color: '#2c3e50', marginTop: 0 }}>📖 How to Use:</h3>
        <ol style={{ color: '#555', lineHeight: '1.8' }}>
          <li><strong>Start with Learning Path</strong> → Understand concepts from official CompTIA blueprint</li>
          <li><strong>Then Practice Questions</strong> → Test knowledge and find weak spots</li>
          <li><strong>Set a 3-week goal</strong> → Track progress toward 85% accuracy</li>
          <li><strong>Review weak topics</strong> → Go back to Learning Path to reinforce</li>
        </ol>
      </div>

      <div style={{ marginTop: '40px', padding: '20px', background: '#f0e8f4', borderRadius: '8px', borderLeft: '4px solid #9b59b6' }}>
        <p style={{ color: '#555', margin: 0 }}>
          <strong>💡 Tip:</strong> This system combines deep understanding (Learning) with exam preparation (Practice). Use them together for best results!
        </p>
      </div>
    </div>
  );
}
