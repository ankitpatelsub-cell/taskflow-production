import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock TanStack Router
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
  useParams: () => ({ projectId: 'test-project-id' }),
  useRouterState: () => ({ location: { pathname: '/app/dashboard' } }),
  Link: ({ children, className, to, ...props }) => {
    const cls = typeof className === 'function' ? className({ isActive: false }) : className;
    return <a href={to} className={cls} {...props}>{children}</a>;
  },
}));

// Mock axios API
vi.mock('@/lib/api', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: [] }),
    post: vi.fn().mockResolvedValue({ data: {} }),
    patch: vi.fn().mockResolvedValue({ data: {} }),
    delete: vi.fn().mockResolvedValue({ data: {} }),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  },
}));

// Mock Radix UI (Popover, DropdownMenu, etc. that use portal)
vi.mock('@radix-ui/react-dialog', () => ({
  Root: ({ children, open }) => open ? <div>{children}</div> : null,
  Portal: ({ children }) => <div>{children}</div>,
  Overlay: ({ className }) => <div className={className} />,
  Content: ({ children, className }) => <div className={className}>{children}</div>,
  Title: ({ children, className }) => <h2 className={className}>{children}</h2>,
  Trigger: ({ children, asChild }) => <div>{children}</div>,
}));

vi.mock('@radix-ui/react-popover', () => ({
  Root: ({ children }) => <div>{children}</div>,
  Trigger: ({ children }) => <div>{children}</div>,
  Portal: ({ children }) => <div>{children}</div>,
  Content: ({ children, className }) => <div className={className}>{children}</div>,
}));

vi.mock('@radix-ui/react-dropdown-menu', () => ({
  Root: ({ children }) => <div>{children}</div>,
  Trigger: ({ children }) => <div>{children}</div>,
  Portal: ({ children }) => <div>{children}</div>,
  Content: ({ children, className }) => <div className={className}>{children}</div>,
  Item: ({ children, className, onSelect }) => <button className={className} onClick={onSelect}>{children}</button>,
  Separator: () => <hr />,
}));

// Suppress console.error in tests
vi.spyOn(console, 'error').mockImplementation(() => {});
