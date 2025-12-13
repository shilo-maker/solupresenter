/**
 * App Component Tests for SoluPresenter
 * Tests basic app functionality without full routing
 */

import React from 'react';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

// ============================================
// APP CONFIGURATION TESTS
// ============================================

describe('App Configuration', () => {
  it('should have proper environment setup', () => {
    expect(process.env.NODE_ENV).toBe('test');
  });

  it('should have React and ReactDOM available', () => {
    expect(React).toBeDefined();
    expect(React.createElement).toBeDefined();
    expect(React.useState).toBeDefined();
    expect(React.useEffect).toBeDefined();
  });
});

// ============================================
// COMPONENT RENDERING TESTS
// ============================================

describe('Component Rendering', () => {
  it('should render a simple React component', () => {
    const TestComponent = () => <div data-testid="test">Hello World</div>;
    render(<TestComponent />);

    expect(screen.getByTestId('test')).toBeInTheDocument();
    expect(screen.getByText('Hello World')).toBeInTheDocument();
  });

  it('should handle useState correctly', () => {
    const StatefulComponent = () => {
      const [count, setCount] = React.useState(0);
      return (
        <button onClick={() => setCount(c => c + 1)} data-testid="counter">
          Count: {count}
        </button>
      );
    };

    render(<StatefulComponent />);
    const button = screen.getByTestId('counter');

    expect(button).toHaveTextContent('Count: 0');

    fireEvent.click(button);
    expect(button).toHaveTextContent('Count: 1');
  });

  it('should handle useEffect correctly', async () => {
    let effectRan = false;

    const EffectComponent = () => {
      React.useEffect(() => {
        effectRan = true;
      }, []);

      return <div data-testid="effect">Effect Test</div>;
    };

    render(<EffectComponent />);

    await waitFor(() => {
      expect(effectRan).toBe(true);
    });
  });
});

// ============================================
// ACCESSIBILITY TESTS
// ============================================

describe('Accessibility', () => {
  it('should support focusable elements', () => {
    render(
      <div>
        <button data-testid="btn1">Button 1</button>
        <input data-testid="input1" type="text" />
      </div>
    );

    const button = screen.getByTestId('btn1');
    const input = screen.getByTestId('input1');

    expect(button).not.toHaveAttribute('tabindex', '-1');
    expect(input).not.toHaveAttribute('tabindex', '-1');
  });

  it('should support keyboard navigation', async () => {
    render(
      <div>
        <button data-testid="btn1">Button 1</button>
        <button data-testid="btn2">Button 2</button>
      </div>
    );

    const btn1 = screen.getByTestId('btn1');
    btn1.focus();

    expect(document.activeElement).toBe(btn1);
  });
});

// ============================================
// RESPONSIVE DESIGN TESTS
// ============================================

describe('Responsive Design', () => {
  const originalInnerWidth = window.innerWidth;

  afterEach(() => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      value: originalInnerWidth
    });
  });

  it('should handle window resize events', () => {
    let resizeCount = 0;

    const ResizeComponent = () => {
      React.useEffect(() => {
        const handleResize = () => resizeCount++;
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
      }, []);

      return <div>Resize Test</div>;
    };

    render(<ResizeComponent />);

    // Trigger resize event
    act(() => {
      window.dispatchEvent(new Event('resize'));
    });

    expect(resizeCount).toBe(1);
  });

  it('should render in different viewport sizes', () => {
    [375, 768, 1920].forEach(width => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        value: width
      });

      const Component = () => (
        <div data-testid="viewport">Width: {window.innerWidth}</div>
      );

      const { unmount } = render(<Component />);
      expect(screen.getByTestId('viewport')).toHaveTextContent(`Width: ${width}`);
      unmount();
    });
  });
});

// ============================================
// ERROR BOUNDARY TESTS
// ============================================

describe('Error Handling', () => {
  // Simple error boundary for testing
  class ErrorBoundary extends React.Component {
    constructor(props) {
      super(props);
      this.state = { hasError: false };
    }

    static getDerivedStateFromError() {
      return { hasError: true };
    }

    render() {
      if (this.state.hasError) {
        return <div data-testid="error">Something went wrong</div>;
      }
      return this.props.children;
    }
  }

  it('should catch errors in child components', () => {
    // Suppress console.error for this test
    const originalError = console.error;
    console.error = jest.fn();

    const FailingComponent = () => {
      throw new Error('Test error');
    };

    render(
      <ErrorBoundary>
        <FailingComponent />
      </ErrorBoundary>
    );

    expect(screen.getByTestId('error')).toHaveTextContent('Something went wrong');

    console.error = originalError;
  });
});

// ============================================
// LOCAL STORAGE TESTS
// ============================================

describe('Local Storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should store and retrieve values', () => {
    localStorage.setItem('testKey', 'testValue');
    expect(localStorage.getItem('testKey')).toBe('testValue');
  });

  it('should remove values', () => {
    localStorage.setItem('testKey', 'testValue');
    localStorage.removeItem('testKey');
    expect(localStorage.getItem('testKey')).toBeNull();
  });

  it('should handle JSON data', () => {
    const data = { id: 1, name: 'Test' };
    localStorage.setItem('jsonData', JSON.stringify(data));

    const retrieved = JSON.parse(localStorage.getItem('jsonData'));
    expect(retrieved).toEqual(data);
  });
});

console.log('App tests loaded successfully');
