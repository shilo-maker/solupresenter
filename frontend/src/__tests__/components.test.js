/**
 * Comprehensive Component Tests
 * Tests React components, hooks, and UI functionality
 *
 * Note: These tests use inline component definitions to test patterns
 * commonly used in the application without requiring actual imports.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

// ============================================
// CUSTOM HOOKS TESTS
// ============================================

describe('Custom Hooks', () => {
  describe('useLocalStorage', () => {
    const useLocalStorage = (key, initialValue) => {
      const [storedValue, setStoredValue] = React.useState(() => {
        try {
          const item = window.localStorage.getItem(key);
          return item ? JSON.parse(item) : initialValue;
        } catch (error) {
          return initialValue;
        }
      });

      const setValue = (value) => {
        try {
          setStoredValue(value);
          window.localStorage.setItem(key, JSON.stringify(value));
        } catch (error) {
          console.error(error);
        }
      };

      return [storedValue, setValue];
    };

    const TestComponent = ({ storageKey, initialValue }) => {
      const [value, setValue] = useLocalStorage(storageKey, initialValue);

      return (
        <div>
          <span data-testid="value">{JSON.stringify(value)}</span>
          <button onClick={() => setValue('updated')}>Update</button>
        </div>
      );
    };

    beforeEach(() => {
      localStorage.clear();
    });

    it('should initialize with default value', () => {
      render(<TestComponent storageKey="test" initialValue="default" />);

      expect(screen.getByTestId('value')).toHaveTextContent('"default"');
    });

    it('should read existing localStorage value', () => {
      localStorage.setItem('test', JSON.stringify('existing'));

      render(<TestComponent storageKey="test" initialValue="default" />);

      expect(screen.getByTestId('value')).toHaveTextContent('"existing"');
    });

    it('should update localStorage on change', async () => {
      render(<TestComponent storageKey="test" initialValue="default" />);

      fireEvent.click(screen.getByText('Update'));

      expect(localStorage.getItem('test')).toBe('"updated"');
    });
  });

  describe('useDebounce', () => {
    const useDebounce = (value, delay) => {
      const [debouncedValue, setDebouncedValue] = React.useState(value);

      React.useEffect(() => {
        const handler = setTimeout(() => {
          setDebouncedValue(value);
        }, delay);

        return () => {
          clearTimeout(handler);
        };
      }, [value, delay]);

      return debouncedValue;
    };

    const TestComponent = ({ delay }) => {
      const [value, setValue] = React.useState('');
      const debouncedValue = useDebounce(value, delay);

      return (
        <div>
          <input
            data-testid="input"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <span data-testid="debounced">{debouncedValue}</span>
        </div>
      );
    };

    it('should debounce value changes', async () => {
      jest.useFakeTimers();

      render(<TestComponent delay={300} />);

      const input = screen.getByTestId('input');

      fireEvent.change(input, { target: { value: 'test' } });

      // Value should not be updated immediately
      expect(screen.getByTestId('debounced')).toHaveTextContent('');

      // Fast-forward timers
      act(() => {
        jest.advanceTimersByTime(300);
      });

      expect(screen.getByTestId('debounced')).toHaveTextContent('test');

      jest.useRealTimers();
    });
  });

  describe('useWindowSize', () => {
    const useWindowSize = () => {
      const [size, setSize] = React.useState({
        width: window.innerWidth,
        height: window.innerHeight
      });

      React.useEffect(() => {
        const handleResize = () => {
          setSize({
            width: window.innerWidth,
            height: window.innerHeight
          });
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
      }, []);

      return size;
    };

    const TestComponent = () => {
      const { width, height } = useWindowSize();

      return (
        <div>
          <span data-testid="width">{width}</span>
          <span data-testid="height">{height}</span>
        </div>
      );
    };

    it('should return current window dimensions', () => {
      render(<TestComponent />);

      expect(screen.getByTestId('width')).toHaveTextContent(String(window.innerWidth));
      expect(screen.getByTestId('height')).toHaveTextContent(String(window.innerHeight));
    });

    it('should update on resize', async () => {
      render(<TestComponent />);

      act(() => {
        Object.defineProperty(window, 'innerWidth', { writable: true, value: 800 });
        Object.defineProperty(window, 'innerHeight', { writable: true, value: 600 });
        window.dispatchEvent(new Event('resize'));
      });

      expect(screen.getByTestId('width')).toHaveTextContent('800');
      expect(screen.getByTestId('height')).toHaveTextContent('600');
    });
  });
});

// ============================================
// FORM COMPONENT TESTS
// ============================================

describe('Form Components', () => {
  describe('Login Form', () => {
    const LoginForm = ({ onSubmit }) => {
      const [email, setEmail] = React.useState('');
      const [password, setPassword] = React.useState('');
      const [error, setError] = React.useState('');

      const handleSubmit = (e) => {
        e.preventDefault();
        setError('');

        if (!email || !password) {
          setError('Please fill in all fields');
          return;
        }

        onSubmit({ email, password });
      };

      return (
        <form onSubmit={handleSubmit} data-testid="login-form">
          {error && <div data-testid="error">{error}</div>}
          <input
            type="email"
            data-testid="email-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
          />
          <input
            type="password"
            data-testid="password-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
          />
          <button type="submit" data-testid="submit-btn">
            Login
          </button>
        </form>
      );
    };

    it('should render all form elements', () => {
      render(<LoginForm onSubmit={jest.fn()} />);

      expect(screen.getByTestId('email-input')).toBeInTheDocument();
      expect(screen.getByTestId('password-input')).toBeInTheDocument();
      expect(screen.getByTestId('submit-btn')).toBeInTheDocument();
    });

    it('should show error for empty submission', async () => {
      render(<LoginForm onSubmit={jest.fn()} />);

      fireEvent.click(screen.getByTestId('submit-btn'));

      expect(screen.getByTestId('error')).toHaveTextContent('Please fill in all fields');
    });

    it('should call onSubmit with credentials', async () => {
      const mockSubmit = jest.fn();
      render(<LoginForm onSubmit={mockSubmit} />);

      fireEvent.change(screen.getByTestId('email-input'), {
        target: { value: 'test@example.com' }
      });
      fireEvent.change(screen.getByTestId('password-input'), {
        target: { value: 'password123' }
      });
      fireEvent.click(screen.getByTestId('submit-btn'));

      expect(mockSubmit).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123'
      });
    });
  });

  describe('Search Input', () => {
    const SearchInput = ({ onSearch, placeholder = 'Search...' }) => {
      const [query, setQuery] = React.useState('');

      const handleChange = (e) => {
        const value = e.target.value;
        setQuery(value);
        onSearch(value);
      };

      const handleClear = () => {
        setQuery('');
        onSearch('');
      };

      return (
        <div data-testid="search-container">
          <input
            type="text"
            data-testid="search-input"
            value={query}
            onChange={handleChange}
            placeholder={placeholder}
          />
          {query && (
            <button data-testid="clear-btn" onClick={handleClear}>
              Clear
            </button>
          )}
        </div>
      );
    };

    it('should call onSearch when typing', () => {
      const mockSearch = jest.fn();
      render(<SearchInput onSearch={mockSearch} />);

      fireEvent.change(screen.getByTestId('search-input'), {
        target: { value: 'test query' }
      });

      expect(mockSearch).toHaveBeenCalledWith('test query');
    });

    it('should show clear button when there is text', () => {
      render(<SearchInput onSearch={jest.fn()} />);

      expect(screen.queryByTestId('clear-btn')).not.toBeInTheDocument();

      fireEvent.change(screen.getByTestId('search-input'), {
        target: { value: 'test' }
      });

      expect(screen.getByTestId('clear-btn')).toBeInTheDocument();
    });

    it('should clear input and call onSearch with empty string', () => {
      const mockSearch = jest.fn();
      render(<SearchInput onSearch={mockSearch} />);

      fireEvent.change(screen.getByTestId('search-input'), {
        target: { value: 'test' }
      });

      fireEvent.click(screen.getByTestId('clear-btn'));

      expect(screen.getByTestId('search-input')).toHaveValue('');
      expect(mockSearch).toHaveBeenLastCalledWith('');
    });
  });
});

// ============================================
// LIST COMPONENT TESTS
// ============================================

describe('List Components', () => {
  describe('Song List', () => {
    const SongList = ({ songs, onSelect }) => {
      if (!songs || songs.length === 0) {
        return <div data-testid="empty-state">No songs found</div>;
      }

      return (
        <ul data-testid="song-list">
          {songs.map((song) => (
            <li
              key={song.id}
              data-testid={`song-${song.id}`}
              onClick={() => onSelect(song)}
            >
              <span data-testid={`song-title-${song.id}`}>{song.title}</span>
              {song.author && (
                <span data-testid={`song-author-${song.id}`}>by {song.author}</span>
              )}
            </li>
          ))}
        </ul>
      );
    };

    it('should render empty state when no songs', () => {
      render(<SongList songs={[]} onSelect={jest.fn()} />);

      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    });

    it('should render list of songs', () => {
      const songs = [
        { id: '1', title: 'Song One' },
        { id: '2', title: 'Song Two' }
      ];

      render(<SongList songs={songs} onSelect={jest.fn()} />);

      expect(screen.getByTestId('song-1')).toBeInTheDocument();
      expect(screen.getByTestId('song-2')).toBeInTheDocument();
    });

    it('should call onSelect when song clicked', () => {
      const songs = [{ id: '1', title: 'Test Song' }];
      const mockSelect = jest.fn();

      render(<SongList songs={songs} onSelect={mockSelect} />);

      fireEvent.click(screen.getByTestId('song-1'));

      expect(mockSelect).toHaveBeenCalledWith(songs[0]);
    });

    it('should show author when available', () => {
      const songs = [{ id: '1', title: 'Test Song', author: 'Test Author' }];

      render(<SongList songs={songs} onSelect={jest.fn()} />);

      expect(screen.getByTestId('song-author-1')).toHaveTextContent('by Test Author');
    });
  });
});

// ============================================
// MODAL COMPONENT TESTS
// ============================================

describe('Modal Components', () => {
  const Modal = ({ isOpen, onClose, title, children }) => {
    if (!isOpen) return null;

    return (
      <div data-testid="modal-backdrop" onClick={onClose}>
        <div
          data-testid="modal-content"
          onClick={(e) => e.stopPropagation()}
        >
          <div data-testid="modal-header">
            <h2>{title}</h2>
            <button data-testid="modal-close" onClick={onClose}>
              ×
            </button>
          </div>
          <div data-testid="modal-body">{children}</div>
        </div>
      </div>
    );
  };

  it('should not render when closed', () => {
    render(<Modal isOpen={false} onClose={jest.fn()} title="Test" />);

    expect(screen.queryByTestId('modal-backdrop')).not.toBeInTheDocument();
  });

  it('should render when open', () => {
    render(
      <Modal isOpen={true} onClose={jest.fn()} title="Test Modal">
        <p>Modal content</p>
      </Modal>
    );

    expect(screen.getByTestId('modal-backdrop')).toBeInTheDocument();
    expect(screen.getByText('Test Modal')).toBeInTheDocument();
    expect(screen.getByText('Modal content')).toBeInTheDocument();
  });

  it('should call onClose when backdrop clicked', () => {
    const mockClose = jest.fn();

    render(
      <Modal isOpen={true} onClose={mockClose} title="Test">
        Content
      </Modal>
    );

    fireEvent.click(screen.getByTestId('modal-backdrop'));

    expect(mockClose).toHaveBeenCalled();
  });

  it('should not close when content clicked', () => {
    const mockClose = jest.fn();

    render(
      <Modal isOpen={true} onClose={mockClose} title="Test">
        Content
      </Modal>
    );

    fireEvent.click(screen.getByTestId('modal-content'));

    expect(mockClose).not.toHaveBeenCalled();
  });

  it('should close when close button clicked', () => {
    const mockClose = jest.fn();

    render(
      <Modal isOpen={true} onClose={mockClose} title="Test">
        Content
      </Modal>
    );

    fireEvent.click(screen.getByTestId('modal-close'));

    expect(mockClose).toHaveBeenCalled();
  });
});

// ============================================
// DROPDOWN/SELECT TESTS
// ============================================

describe('Dropdown Components', () => {
  const Dropdown = ({ options, value, onChange, placeholder }) => {
    return (
      <select
        data-testid="dropdown"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {placeholder && (
          <option value="" data-testid="placeholder-option">
            {placeholder}
          </option>
        )}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} data-testid={`option-${opt.value}`}>
            {opt.label}
          </option>
        ))}
      </select>
    );
  };

  it('should render options', () => {
    const options = [
      { value: 'he', label: 'Hebrew' },
      { value: 'en', label: 'English' }
    ];

    render(<Dropdown options={options} value="" onChange={jest.fn()} />);

    expect(screen.getByTestId('option-he')).toBeInTheDocument();
    expect(screen.getByTestId('option-en')).toBeInTheDocument();
  });

  it('should show placeholder', () => {
    const options = [{ value: 'he', label: 'Hebrew' }];

    render(
      <Dropdown
        options={options}
        value=""
        onChange={jest.fn()}
        placeholder="Select language"
      />
    );

    expect(screen.getByTestId('placeholder-option')).toHaveTextContent('Select language');
  });

  it('should call onChange when selection changes', () => {
    const options = [
      { value: 'he', label: 'Hebrew' },
      { value: 'en', label: 'English' }
    ];
    const mockChange = jest.fn();

    render(<Dropdown options={options} value="" onChange={mockChange} />);

    fireEvent.change(screen.getByTestId('dropdown'), { target: { value: 'en' } });

    expect(mockChange).toHaveBeenCalledWith('en');
  });
});

// ============================================
// TOGGLE/SWITCH TESTS
// ============================================

describe('Toggle Components', () => {
  const Toggle = ({ checked, onChange, label }) => {
    return (
      <label data-testid="toggle-container">
        <input
          type="checkbox"
          data-testid="toggle-input"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span data-testid="toggle-label">{label}</span>
      </label>
    );
  };

  it('should render with correct checked state', () => {
    render(<Toggle checked={true} onChange={jest.fn()} label="Test" />);

    expect(screen.getByTestId('toggle-input')).toBeChecked();
  });

  it('should call onChange when toggled', () => {
    const mockChange = jest.fn();

    render(<Toggle checked={false} onChange={mockChange} label="Test" />);

    fireEvent.click(screen.getByTestId('toggle-input'));

    expect(mockChange).toHaveBeenCalledWith(true);
  });

  it('should display label', () => {
    render(<Toggle checked={false} onChange={jest.fn()} label="Enable Feature" />);

    expect(screen.getByTestId('toggle-label')).toHaveTextContent('Enable Feature');
  });
});

// ============================================
// LOADING STATE TESTS
// ============================================

describe('Loading States', () => {
  const LoadingSpinner = ({ isLoading, children }) => {
    if (isLoading) {
      return <div data-testid="loading-spinner">Loading...</div>;
    }

    return <div data-testid="content">{children}</div>;
  };

  it('should show spinner when loading', () => {
    render(<LoadingSpinner isLoading={true}>Content</LoadingSpinner>);

    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
    expect(screen.queryByTestId('content')).not.toBeInTheDocument();
  });

  it('should show content when not loading', () => {
    render(<LoadingSpinner isLoading={false}>Content</LoadingSpinner>);

    expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
    expect(screen.getByTestId('content')).toBeInTheDocument();
  });
});

// ============================================
// ERROR BOUNDARY TESTS
// ============================================

describe('Error Boundaries', () => {
  class ErrorBoundary extends React.Component {
    constructor(props) {
      super(props);
      this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
      return { hasError: true, error };
    }

    render() {
      if (this.state.hasError) {
        return (
          <div data-testid="error-boundary">
            <h2>Something went wrong</h2>
            <p>{this.state.error?.message}</p>
            <button onClick={() => this.setState({ hasError: false })}>
              Try again
            </button>
          </div>
        );
      }

      return this.props.children;
    }
  }

  it('should catch and display errors', () => {
    const ThrowError = () => {
      throw new Error('Test error');
    };

    // Suppress console.error for this test
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );

    expect(screen.getByTestId('error-boundary')).toBeInTheDocument();
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();

    spy.mockRestore();
  });

  it('should render children when no error', () => {
    render(
      <ErrorBoundary>
        <div data-testid="child">Child content</div>
      </ErrorBoundary>
    );

    expect(screen.getByTestId('child')).toBeInTheDocument();
  });
});

// ============================================
// KEYBOARD NAVIGATION TESTS
// ============================================

describe('Keyboard Navigation', () => {
  const NavigableList = ({ items, onSelect }) => {
    const [focusIndex, setFocusIndex] = React.useState(0);

    const handleKeyDown = (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusIndex((prev) => Math.min(prev + 1, items.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter') {
        onSelect(items[focusIndex]);
      }
    };

    return (
      <ul data-testid="navigable-list" onKeyDown={handleKeyDown} tabIndex={0}>
        {items.map((item, index) => (
          <li
            key={item.id}
            data-testid={`item-${item.id}`}
            className={index === focusIndex ? 'focused' : ''}
          >
            {item.name}
          </li>
        ))}
      </ul>
    );
  };

  it('should navigate with arrow keys', () => {
    const items = [
      { id: '1', name: 'Item 1' },
      { id: '2', name: 'Item 2' },
      { id: '3', name: 'Item 3' }
    ];

    render(<NavigableList items={items} onSelect={jest.fn()} />);

    const list = screen.getByTestId('navigable-list');
    list.focus();

    // First item should be focused initially
    expect(screen.getByTestId('item-1')).toHaveClass('focused');

    // Arrow down
    fireEvent.keyDown(list, { key: 'ArrowDown' });
    expect(screen.getByTestId('item-2')).toHaveClass('focused');

    // Arrow up
    fireEvent.keyDown(list, { key: 'ArrowUp' });
    expect(screen.getByTestId('item-1')).toHaveClass('focused');
  });

  it('should select on Enter', () => {
    const items = [{ id: '1', name: 'Item 1' }];
    const mockSelect = jest.fn();

    render(<NavigableList items={items} onSelect={mockSelect} />);

    const list = screen.getByTestId('navigable-list');
    list.focus();

    fireEvent.keyDown(list, { key: 'Enter' });

    expect(mockSelect).toHaveBeenCalledWith(items[0]);
  });
});

// ============================================
// RESPONSIVE TESTS
// ============================================

describe('Responsive Behavior', () => {
  const ResponsiveNav = () => {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

    return (
      <nav data-testid="nav">
        <button
          data-testid="mobile-menu-toggle"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        >
          Menu
        </button>
        <ul
          data-testid="nav-menu"
          className={isMobileMenuOpen ? 'open' : 'closed'}
        >
          <li>Home</li>
          <li>About</li>
        </ul>
      </nav>
    );
  };

  it('should toggle mobile menu', () => {
    render(<ResponsiveNav />);

    const menu = screen.getByTestId('nav-menu');
    const toggle = screen.getByTestId('mobile-menu-toggle');

    expect(menu).toHaveClass('closed');

    fireEvent.click(toggle);
    expect(menu).toHaveClass('open');

    fireEvent.click(toggle);
    expect(menu).toHaveClass('closed');
  });
});

console.log('Component tests loaded successfully');
