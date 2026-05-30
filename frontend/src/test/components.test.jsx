import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { PriorityBadge } from '@/components/shared/PriorityBadge';
import { ActivityFeed } from '@/components/shared/ActivityFeed';

// ─── Button ───────────────────────────────────────────────────────────────────
describe('<Button>', () => {
  it('renders children', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('calls onClick handler', () => {
    const handler = vi.fn();
    render(<Button onClick={handler}>Go</Button>);
    fireEvent.click(screen.getByText('Go'));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('is disabled when disabled prop is passed', () => {
    render(<Button disabled>Disabled</Button>);
    expect(screen.getByText('Disabled').closest('button')).toBeDisabled();
  });

  it('does not call onClick when disabled', () => {
    const handler = vi.fn();
    render(<Button disabled onClick={handler}>Disabled</Button>);
    fireEvent.click(screen.getByText('Disabled'));
    expect(handler).not.toHaveBeenCalled();
  });

  it('applies variant class — danger should contain red styling', () => {
    render(<Button variant="danger">Delete</Button>);
    const btn = screen.getByText('Delete').closest('button');
    expect(btn.className).toContain('red');
  });

  it('applies size class — lg should be larger than sm', () => {
    const { rerender } = render(<Button size="sm">Small</Button>);
    const smClass = screen.getByText('Small').closest('button').className;
    rerender(<Button size="lg">Large</Button>);
    const lgClass = screen.getByText('Large').closest('button').className;
    expect(smClass).not.toBe(lgClass);
  });
});

// ─── Avatar ───────────────────────────────────────────────────────────────────
describe('<Avatar>', () => {
  it('shows initials when no src', () => {
    render(<Avatar name="Alice Bhatt" />);
    expect(screen.getByText('AB')).toBeInTheDocument();
  });

  it('shows first letter only for single-word name', () => {
    render(<Avatar name="Alice" />);
    expect(screen.getByText('A')).toBeInTheDocument();
  });

  it('renders img element when src is provided', () => {
    render(<Avatar name="Bob" src="/avatar.png" />);
    const img = screen.getByRole('img');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', '/avatar.png');
  });

  it('applies different size classes', () => {
    const { rerender } = render(<Avatar name="C" size="sm" />);
    // Capture className before rerender (rerender modifies the same DOM node)
    const smClassName = screen.getByText('C').closest('div').className;
    rerender(<Avatar name="C" size="lg" />);
    const lgClassName = screen.getByText('C').closest('div').className;
    expect(smClassName).not.toBe(lgClassName);
  });

  it('handles empty name gracefully', () => {
    expect(() => render(<Avatar name="" />)).not.toThrow();
  });
});

// ─── Badge ────────────────────────────────────────────────────────────────────
describe('<Badge>', () => {
  it('renders children text', () => {
    render(<Badge>New</Badge>);
    expect(screen.getByText('New')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    render(<Badge className="bg-red-100 text-red-700">Error</Badge>);
    const el = screen.getByText('Error');
    expect(el.className).toContain('bg-red-100');
  });
});

// ─── Input ────────────────────────────────────────────────────────────────────
describe('<Input>', () => {
  it('renders with placeholder', () => {
    render(<Input placeholder="Enter text" />);
    expect(screen.getByPlaceholderText('Enter text')).toBeInTheDocument();
  });

  it('calls onChange on user input', () => {
    const onChange = vi.fn();
    render(<Input onChange={onChange} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'hello' } });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('is disabled when disabled prop is set', () => {
    render(<Input disabled placeholder="Read only" />);
    expect(screen.getByPlaceholderText('Read only')).toBeDisabled();
  });

  it('passes value prop through', () => {
    render(<Input value="prefilled" onChange={() => {}} />);
    expect(screen.getByDisplayValue('prefilled')).toBeInTheDocument();
  });
});

// ─── PriorityBadge ────────────────────────────────────────────────────────────
describe('<PriorityBadge>', () => {
  it('renders Low priority correctly', () => {
    render(<PriorityBadge priority="low" />);
    expect(screen.getByText('Low')).toBeInTheDocument();
  });

  it('renders Medium priority correctly', () => {
    render(<PriorityBadge priority="medium" />);
    expect(screen.getByText('Medium')).toBeInTheDocument();
  });

  it('renders High priority correctly', () => {
    render(<PriorityBadge priority="high" />);
    expect(screen.getByText('High')).toBeInTheDocument();
  });

  it('renders Critical priority correctly', () => {
    render(<PriorityBadge priority="critical" />);
    expect(screen.getByText('Critical')).toBeInTheDocument();
  });

  it('uses different colors for different priorities', () => {
    const { rerender } = render(<PriorityBadge priority="low" />);
    const lowClass = screen.getByText('Low').closest('span').className;
    rerender(<PriorityBadge priority="critical" />);
    const critClass = screen.getByText('Critical').closest('span').className;
    expect(lowClass).not.toBe(critClass);
  });

  it('falls back gracefully for unknown priority', () => {
    expect(() => render(<PriorityBadge priority="unknown" />)).not.toThrow();
  });
});

// ─── ActivityFeed ─────────────────────────────────────────────────────────────
describe('<ActivityFeed>', () => {
  it('shows empty state message when no items', () => {
    render(<ActivityFeed items={[]} />);
    expect(screen.getByText(/no activity yet/i)).toBeInTheDocument();
  });

  it('renders activity items', () => {
    const items = [
      { id: '1', user_name: 'Alice', action: 'created the task', created_at: '2026-05-01' },
      { id: '2', user_name: 'Bob', action: 'changed status to Done', created_at: '2026-05-02' },
    ];
    render(<ActivityFeed items={items} />);
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('created the task')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('changed status to Done')).toBeInTheDocument();
  });

  it('shows System for items with no user_name', () => {
    const items = [{ id: '1', user_name: null, action: 'automated action', created_at: '2026-05-01' }];
    render(<ActivityFeed items={items} />);
    expect(screen.getByText('System')).toBeInTheDocument();
  });

  it('renders the correct number of items', () => {
    const items = Array.from({ length: 5 }, (_, i) => ({
      id: String(i),
      user_name: `User ${i}`,
      action: `did action ${i}`,
      created_at: '2026-05-01',
    }));
    render(<ActivityFeed items={items} />);
    expect(screen.getAllByText(/did action/)).toHaveLength(5);
  });
});
