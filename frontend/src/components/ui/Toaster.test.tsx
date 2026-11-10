import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { Toaster } from './Toaster';
import { showToast, useToastStore } from '@/lib/store/toastStore';

beforeEach(() => {
  jest.useFakeTimers();
  useToastStore.setState({ toasts: [] });
});
afterEach(() => {
  act(() => { jest.runOnlyPendingTimers(); });
  jest.useRealTimers();
});

test('failure toast is announced and can be dismissed independently of a folder card', () => {
  render(<Toaster />);
  act(() => { showToast('고정 상태 저장에 실패했습니다.', 'error'); });
  expect(screen.getByRole('alert')).toHaveTextContent('고정 상태 저장에 실패했습니다.');
  fireEvent.click(screen.getByRole('button', { name: 'Close notification' }));
  expect(screen.queryByRole('alert')).toBeNull();
});

test('container does not override each toast role with an assertive live region', () => {
  render(<Toaster />);
  act(() => { showToast('서버 상태를 다시 확인했습니다.', 'info'); });
  const status = screen.getByRole('status');
  expect(status.parentElement).not.toHaveAttribute('aria-live');
  expect(status.closest('[aria-live="assertive"]')).toBeNull();
});

test('informational toast expires after five seconds', () => {
  render(<Toaster />);
  act(() => { showToast('서버 상태를 다시 확인했습니다.', 'info'); });
  expect(screen.getByRole('status')).toHaveTextContent('서버 상태를 다시 확인했습니다.');
  act(() => { jest.advanceTimersByTime(5000); });
  expect(screen.queryByRole('status')).toBeNull();
});
