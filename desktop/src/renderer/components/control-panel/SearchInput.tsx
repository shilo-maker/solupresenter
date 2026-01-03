import React, { memo, useMemo, useCallback, ChangeEvent } from 'react';
import { inputStyles, colors } from '../../styles/controlPanelStyles';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  isRTL?: boolean;
}

const SearchIcon: React.FC = memo(() => (
  <svg width="14" height="14" fill="rgba(255,255,255,0.5)" viewBox="0 0 16 16">
    <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z"/>
  </svg>
));

SearchIcon.displayName = 'SearchIcon';

const SearchInput: React.FC<SearchInputProps> = memo(({
  value,
  onChange,
  placeholder,
  isRTL = false,
}) => {
  const containerStyle = useMemo(() => ({
    position: 'relative' as const,
    flex: 1,
  }), []);

  const iconStyle = useMemo(() => ({
    position: 'absolute' as const,
    left: isRTL ? 'auto' : '10px',
    right: isRTL ? '10px' : 'auto',
    top: '50%',
    transform: 'translateY(-50%)',
  }), [isRTL]);

  const inputStyle = useMemo(() => ({
    ...inputStyles.base,
    ...inputStyles.withIcon(isRTL),
  }), [isRTL]);

  const handleChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  }, [onChange]);

  return (
    <div style={containerStyle}>
      <div style={iconStyle}>
        <SearchIcon />
      </div>
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={handleChange}
        style={inputStyle}
      />
    </div>
  );
});

SearchInput.displayName = 'SearchInput';

export default SearchInput;
