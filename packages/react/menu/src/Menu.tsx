import * as React from 'react';
import { RemoveScroll } from 'react-remove-scroll';
import { hideOthers } from 'aria-hidden';
import { composeEventHandlers } from '@radix-ui/primitive';
import { createCollection } from '@radix-ui/react-collection';
import { composeRefs, useComposedRefs } from '@radix-ui/react-compose-refs';
import { createContext } from '@radix-ui/react-context';
import { DismissableLayer } from '@radix-ui/react-dismissable-layer';
import { FocusScope } from '@radix-ui/react-focus-scope';
import { Presence } from '@radix-ui/react-presence';
import { Primitive, extendPrimitive } from '@radix-ui/react-primitive';
import * as PopperPrimitive from '@radix-ui/react-popper';
import { Portal } from '@radix-ui/react-portal';
import { RovingFocusGroup, RovingFocusItem } from '@radix-ui/react-roving-focus';
import { Slot } from '@radix-ui/react-slot';
import { useCallbackRef } from '@radix-ui/react-use-callback-ref';
import { useFocusGuards } from '@radix-ui/react-focus-guards';
import { useControllableState } from '@radix-ui/react-use-controllable-state';
import { useId } from '@radix-ui/react-id';
import { useMenuTypeahead, useMenuTypeaheadItem } from './useMenuTypeahead';

import type * as Polymorphic from '@radix-ui/react-polymorphic';

type FocusScopeProps = React.ComponentProps<typeof FocusScope>;
type DismissableLayerProps = React.ComponentProps<typeof DismissableLayer>;
type RovingFocusGroupProps = React.ComponentProps<typeof RovingFocusGroup>;

const FIRST_KEYS = ['ArrowDown', 'PageUp', 'Home'];
const LAST_KEYS = ['ArrowUp', 'PageDown', 'End'];
const ALL_KEYS = [...FIRST_KEYS, ...LAST_KEYS];

/* -------------------------------------------------------------------------------------------------
 * Menu
 * -----------------------------------------------------------------------------------------------*/

const MENU_NAME = 'Menu';

type MenuContextValue = {
  open: boolean;
  onOpenChange(open: boolean): void;
};

const [MenuProvider, useMenuContext] = createContext<MenuContextValue>(MENU_NAME);

type MenuOwnProps = {
  open?: boolean;
  onOpenChange?(open: boolean): void;
};

const Menu: React.FC<MenuOwnProps> = (props) => {
  const { open = false, children, onOpenChange } = props;
  const handleOpenChange = useCallbackRef(onOpenChange);

  React.useEffect(() => {
    const handleMenuClose = (event: Event) => {
      if (event.defaultPrevented) return;
      handleOpenChange(false);
    };

    document.addEventListener(ITEM_SELECT, handleMenuClose);
    return () => document.removeEventListener(ITEM_SELECT, handleMenuClose);
  }, [handleOpenChange]);

  return (
    <PopperPrimitive.Root>
      <MenuProvider open={open} onOpenChange={handleOpenChange}>
        {children}
      </MenuProvider>
    </PopperPrimitive.Root>
  );
};

Menu.displayName = MENU_NAME;

/* -------------------------------------------------------------------------------------------------
 * MenuContent
 * -----------------------------------------------------------------------------------------------*/

const CONTENT_NAME = 'MenuContent';

type ItemData = { disabled: boolean };
const [CollectionSlot, CollectionItemSlot, useCollection] = createCollection<
  React.ElementRef<typeof MenuItem>,
  ItemData
>();

type MenuContentContextValue = { onItemLeave(): void };
const [MenuContentProvider, useMenuContentContext] = createContext<MenuContentContextValue>(
  CONTENT_NAME
);

type MenuContentOwnProps = Polymorphic.Merge<
  Polymorphic.OwnProps<typeof MenuContentImpl>,
  {
    /**
     * Used to force mounting when more control is needed. Useful when
     * controlling animation with React animation libraries.
     */
    forceMount?: true;
  }
>;

type MenuContentPrimitive = Polymorphic.ForwardRefComponent<
  Polymorphic.IntrinsicElement<typeof MenuContentImpl>,
  MenuContentOwnProps
>;

const MenuContent = React.forwardRef((props, forwardedRef) => {
  const { forceMount, ...contentProps } = props;
  const context = useMenuContext(CONTENT_NAME);
  return (
    <Presence present={forceMount || context.open}>
      <CollectionSlot>
        <MenuContentImpl
          data-state={getOpenState(context.open)}
          {...contentProps}
          ref={forwardedRef}
        />
      </CollectionSlot>
    </Presence>
  );
}) as MenuContentPrimitive;

type MenuContentImplOwnProps = Polymorphic.Merge<
  Polymorphic.OwnProps<typeof PopperPrimitive.Content>,
  {
    /**
     * Whether focus should be trapped within the `MenuContent`
     * (default: false)
     */
    trapFocus?: FocusScopeProps['trapped'];

    /**
     * Event handler called when auto-focusing on open.
     * Can be prevented.
     */
    onOpenAutoFocus?: FocusScopeProps['onMountAutoFocus'];

    /**
     * Event handler called when auto-focusing on close.
     * Can be prevented.
     */
    onCloseAutoFocus?: FocusScopeProps['onUnmountAutoFocus'];

    /**
     * When `true`, hover/focus/click interactions will be disabled on elements outside the `MenuContent`.
     * Users will need to click twice on outside elements to interact with them:
     * Once to close the `MenuContent`, and again to trigger the element.
     */
    disableOutsidePointerEvents?: DismissableLayerProps['disableOutsidePointerEvents'];

    /**
     * Event handler called when the escape key is down.
     * Can be prevented.
     */
    onEscapeKeyDown?: DismissableLayerProps['onEscapeKeyDown'];

    /**
     * Event handler called when the a pointer event happens outside of the `MenuContent`.
     * Can be prevented.
     */
    onPointerDownOutside?: DismissableLayerProps['onPointerDownOutside'];

    /**
     * Event handler called when the focus moves outside of the `MenuContent`.
     * Can be prevented.
     */
    onFocusOutside?: DismissableLayerProps['onFocusOutside'];

    /**
     * Event handler called when an interaction happens outside the `MenuContent`.
     * Specifically, when a pointer event happens outside of the `MenuContent` or focus moves outside of it.
     * Can be prevented.
     */
    onInteractOutside?: DismissableLayerProps['onInteractOutside'];

    /**
     * Whether scrolling outside the `MenuContent` should be prevented
     * (default: `false`)
     */
    disableOutsideScroll?: boolean;

    /**
     * The direction of navigation between menu items.
     * @defaultValue ltr
     */
    dir?: RovingFocusGroupProps['dir'];

    /**
     * Whether keyboard navigation should loop around
     * @defaultValue false
     */
    loop?: RovingFocusGroupProps['loop'];

    /**
     * Whether the `MenuContent` should render in a `Portal`
     * (default: `true`)
     */
    portalled?: boolean;
  }
>;

type MenuContentImplPrimitive = Polymorphic.ForwardRefComponent<
  Polymorphic.IntrinsicElement<typeof PopperPrimitive.Content>,
  MenuContentImplOwnProps
>;

const MenuContentImpl = React.forwardRef((props, forwardedRef) => {
  const {
    dir = 'ltr',
    loop = false,
    trapFocus,
    onOpenAutoFocus,
    onCloseAutoFocus,
    disableOutsidePointerEvents,
    onEscapeKeyDown,
    onPointerDownOutside,
    onFocusOutside,
    onInteractOutside,
    disableOutsideScroll,
    portalled,
    ...contentProps
  } = props;
  const context = useMenuContext(CONTENT_NAME);
  const contentRef = React.useRef<HTMLDivElement>(null);
  const typeaheadProps = useMenuTypeahead();
  const { getItems } = useCollection();

  const [currentItemId, setCurrentItemId] = React.useState<string | null>(null);
  const [
    isPermittedPointerDownOutsideEvent,
    setIsPermittedPointerDownOutsideEvent,
  ] = React.useState(false);

  const PortalWrapper = portalled ? Portal : React.Fragment;
  const ScrollLockWrapper = disableOutsideScroll ? RemoveScroll : React.Fragment;

  // Make sure the whole tree has focus guards as our `MenuContent` may be
  // the last element in the DOM (beacuse of the `Portal`)
  useFocusGuards();

  // Hide everything from ARIA except the `MenuContent`
  React.useEffect(() => {
    const content = contentRef.current;
    if (content) return hideOthers(content);
  }, []);

  return (
    <PortalWrapper>
      <ScrollLockWrapper>
        <MenuContentProvider
          onItemLeave={React.useCallback(() => {
            contentRef.current?.focus();
            setCurrentItemId(null);
          }, [])}
        >
          <FocusScope
            // clicking outside may raise a focusout event, which may get trapped.
            // in cases where outside pointer events are permitted, we stop trapping.
            // we also make sure we're not trapping once it's been closed
            // (closed !== unmounted when animating out)
            trapped={isPermittedPointerDownOutsideEvent ? false : trapFocus && context.open}
            onMountAutoFocus={onOpenAutoFocus}
            onUnmountAutoFocus={(event) => {
              // skip autofocus on unmount if clicking outside is permitted and it happened
              if (isPermittedPointerDownOutsideEvent) {
                event.preventDefault();
              } else {
                onCloseAutoFocus?.(event);
              }
            }}
          >
            {(focusScopeProps) => (
              <DismissableLayer
                disableOutsidePointerEvents={disableOutsidePointerEvents}
                onEscapeKeyDown={onEscapeKeyDown}
                onPointerDownOutside={composeEventHandlers(
                  onPointerDownOutside,
                  (event) => {
                    const isLeftClick =
                      (event as MouseEvent).button === 0 && event.ctrlKey === false;
                    const isPermitted = !disableOutsidePointerEvents && isLeftClick;
                    setIsPermittedPointerDownOutsideEvent(isPermitted);

                    if (event.defaultPrevented) {
                      // reset this because the event was prevented
                      setIsPermittedPointerDownOutsideEvent(false);
                    }
                  },
                  { checkForDefaultPrevented: false }
                )}
                onFocusOutside={composeEventHandlers(
                  onFocusOutside,
                  (event) => {
                    // When focus is trapped, a focusout event may still happen.
                    // We make sure we don't trigger our `onDismiss` in such case.
                    if (trapFocus) event.preventDefault();
                  },
                  { checkForDefaultPrevented: false }
                )}
                onInteractOutside={onInteractOutside}
                onDismiss={() => context.onOpenChange(false)}
              >
                {(dismissableLayerProps) => (
                  <RovingFocusGroup
                    as={Slot}
                    dir={dir}
                    orientation="vertical"
                    loop={loop}
                    currentTabStopId={currentItemId}
                    onCurrentTabStopIdChange={setCurrentItemId}
                    // we override the default behaviour which automatically focuses the first item
                    onEntryFocus={(event) => event.preventDefault()}
                  >
                    <PopperPrimitive.Content
                      role="menu"
                      {...focusScopeProps}
                      {...contentProps}
                      ref={composeRefs(forwardedRef, contentRef, focusScopeProps.ref)}
                      style={{
                        ...dismissableLayerProps.style,
                        outline: 'none',
                        ...contentProps.style,
                      }}
                      onBlurCapture={composeEventHandlers(
                        contentProps.onBlurCapture,
                        dismissableLayerProps.onBlurCapture,
                        { checkForDefaultPrevented: false }
                      )}
                      onFocusCapture={composeEventHandlers(
                        contentProps.onFocusCapture,
                        dismissableLayerProps.onFocusCapture,
                        { checkForDefaultPrevented: false }
                      )}
                      onMouseDownCapture={composeEventHandlers(
                        contentProps.onMouseDownCapture,
                        dismissableLayerProps.onMouseDownCapture,
                        { checkForDefaultPrevented: false }
                      )}
                      onTouchStartCapture={composeEventHandlers(
                        contentProps.onTouchStartCapture,
                        dismissableLayerProps.onTouchStartCapture,
                        { checkForDefaultPrevented: false }
                      )}
                      onKeyDownCapture={composeEventHandlers(
                        contentProps.onKeyDownCapture,
                        typeaheadProps.onKeyDownCapture
                      )}
                      // focus first/last item based on key pressed
                      onKeyDown={composeEventHandlers(
                        contentProps.onKeyDown,
                        composeEventHandlers(focusScopeProps.onKeyDown, (event) => {
                          const content = contentRef.current;
                          if (event.target !== content) return;
                          if (!ALL_KEYS.includes(event.key)) return;
                          event.preventDefault();
                          const items = getItems().filter((item) => !item.disabled);
                          const candidateNodes = items.map((item) => item.ref.current!);
                          if (LAST_KEYS.includes(event.key)) candidateNodes.reverse();
                          focusFirst(candidateNodes);
                        })
                      )}
                    />
                  </RovingFocusGroup>
                )}
              </DismissableLayer>
            )}
          </FocusScope>
        </MenuContentProvider>
      </ScrollLockWrapper>
    </PortalWrapper>
  );
}) as MenuContentImplPrimitive;

MenuContent.displayName = CONTENT_NAME;

/* -------------------------------------------------------------------------------------------------
 * MenuItem
 * -----------------------------------------------------------------------------------------------*/

const ITEM_NAME = 'MenuItem';
const ITEM_DEFAULT_TAG = 'div';
const ITEM_SELECT = 'menu.itemSelect';

type MenuItemOwnProps = Polymorphic.Merge<
  Omit<Polymorphic.OwnProps<typeof RovingFocusItem>, 'focusable' | 'active'>,
  {
    disabled?: boolean;
    textValue?: string;
    onSelect?: (event: Event) => void;
  }
>;

type MenuItemPrimitive = Polymorphic.ForwardRefComponent<typeof ITEM_DEFAULT_TAG, MenuItemOwnProps>;

const MenuItem = React.forwardRef((props, forwardedRef) => {
  const { as = ITEM_DEFAULT_TAG, disabled = false, textValue, onSelect, ...itemProps } = props;
  const ref = React.useRef<HTMLDivElement>(null);
  const composedRefs = useComposedRefs(forwardedRef, ref);
  const contentContext = useMenuContentContext(ITEM_NAME);

  // get the item's `.textContent` as default strategy for typeahead `textValue`
  const [textContent, setTextContent] = React.useState('');
  React.useEffect(() => {
    const menuItem = ref.current;
    if (menuItem) {
      setTextContent((menuItem.textContent ?? '').trim());
    }
  }, [itemProps.children]);

  const menuTypeaheadItemProps = useMenuTypeaheadItem({
    textValue: textValue ?? textContent,
    disabled,
  });

  const handleSelect = () => {
    const menuItem = ref.current;
    if (!disabled && menuItem) {
      const itemSelectEvent = new Event(ITEM_SELECT, {
        bubbles: true,
        cancelable: true,
      });
      menuItem.dispatchEvent(itemSelectEvent);
    }
  };

  React.useEffect(() => {
    const menuItem = ref.current;
    if (menuItem) {
      const handleItemSelect = (event: Event) => onSelect?.(event);
      menuItem.addEventListener(ITEM_SELECT, handleItemSelect);
      return () => menuItem.removeEventListener(ITEM_SELECT, handleItemSelect);
    }
  }, [onSelect]);

  return (
    <CollectionItemSlot disabled={disabled}>
      <RovingFocusItem
        role="menuitem"
        aria-disabled={disabled || undefined}
        focusable={!disabled}
        {...itemProps}
        {...menuTypeaheadItemProps}
        as={as}
        ref={composedRefs}
        data-disabled={disabled ? '' : undefined}
        onKeyDown={composeEventHandlers(props.onKeyDown, (event) => {
          if (!disabled && (event.key === 'Enter' || event.key === ' ')) {
            // prevent page scroll if using the space key to select an item
            if (event.key === ' ') event.preventDefault();
            handleSelect();
          }
        })}
        // we handle selection on `mouseUp` rather than `click` to match native menus implementation
        onMouseUp={composeEventHandlers(props.onMouseUp, handleSelect)}
        /**
         * We focus items on `mouseMove` to achieve the following:
         *
         * - Mouse over an item (it focuses)
         * - Leave mouse where it is and use keyboard to focus a different item
         * - Wiggle mouse without it leaving previously focused item
         * - Previously focused item should re-focus
         *
         * If we used `mouseOver`/`mouseEnter` it would not re-focus when the mouse
         * wiggles. This is to match native menu implementation.
         */
        onMouseMove={composeEventHandlers(props.onMouseMove, (event) => {
          if (!disabled) {
            const item = event.currentTarget;
            item.focus();
          } else {
            contentContext.onItemLeave();
          }
        })}
        onMouseLeave={composeEventHandlers(props.onMouseLeave, () => contentContext.onItemLeave())}
      />
    </CollectionItemSlot>
  );
}) as MenuItemPrimitive;

MenuItem.displayName = ITEM_NAME;

/* -------------------------------------------------------------------------------------------------
 * MenuCheckboxItem
 * -----------------------------------------------------------------------------------------------*/

const CHECKBOX_ITEM_NAME = 'MenuCheckboxItem';

type MenuCheckboxItemOwnProps = Polymorphic.Merge<
  Polymorphic.OwnProps<typeof MenuItem>,
  {
    checked?: boolean;
    onCheckedChange?: (checked: boolean) => void;
  }
>;

type MenuCheckboxItemPrimitive = Polymorphic.ForwardRefComponent<
  Polymorphic.IntrinsicElement<typeof MenuItem>,
  MenuCheckboxItemOwnProps
>;

const MenuCheckboxItem = React.forwardRef((props, forwardedRef) => {
  const { checked = false, onCheckedChange, ...checkboxItemProps } = props;
  return (
    <ItemIndicatorContext.Provider value={checked}>
      <MenuItem
        role="menuitemcheckbox"
        aria-checked={checked}
        {...checkboxItemProps}
        ref={forwardedRef}
        data-state={getCheckedState(checked)}
        onSelect={composeEventHandlers(
          checkboxItemProps.onSelect,
          () => onCheckedChange?.(!checked),
          { checkForDefaultPrevented: false }
        )}
      />
    </ItemIndicatorContext.Provider>
  );
}) as MenuCheckboxItemPrimitive;

MenuCheckboxItem.displayName = CHECKBOX_ITEM_NAME;

/* -------------------------------------------------------------------------------------------------
 * MenuRadioGroup
 * -----------------------------------------------------------------------------------------------*/

const RADIO_GROUP_NAME = 'MenuRadioGroup';

const RadioGroupContext = React.createContext<MenuRadioGroupOwnProps>({} as any);

type MenuRadioGroupOwnProps = Polymorphic.Merge<
  Polymorphic.OwnProps<typeof MenuGroup>,
  {
    value?: string;
    onValueChange?: (value: string) => void;
  }
>;

type MenuRadioGroupPrimitive = Polymorphic.ForwardRefComponent<
  Polymorphic.IntrinsicElement<typeof MenuGroup>,
  MenuRadioGroupOwnProps
>;

const MenuRadioGroup = React.forwardRef((props, forwardedRef) => {
  const { value, onValueChange, ...groupProps } = props;
  const handleValueChange = useCallbackRef(onValueChange);
  const context = React.useMemo(() => ({ value, onValueChange: handleValueChange }), [
    value,
    handleValueChange,
  ]);
  return (
    <RadioGroupContext.Provider value={context}>
      <MenuGroup {...groupProps} ref={forwardedRef} />
    </RadioGroupContext.Provider>
  );
}) as MenuRadioGroupPrimitive;

MenuRadioGroup.displayName = RADIO_GROUP_NAME;

/* -------------------------------------------------------------------------------------------------
 * MenuRadioItem
 * -----------------------------------------------------------------------------------------------*/

const RADIO_ITEM_NAME = 'MenuRadioItem';

type MenuRadioItemOwnProps = Polymorphic.Merge<
  Polymorphic.OwnProps<typeof MenuItem>,
  { value: string }
>;
type MenuRadioItemPrimitive = Polymorphic.ForwardRefComponent<
  Polymorphic.IntrinsicElement<typeof MenuItem>,
  MenuRadioItemOwnProps
>;

const MenuRadioItem = React.forwardRef((props, forwardedRef) => {
  const { value, ...radioItemProps } = props;
  const context = React.useContext(RadioGroupContext);
  const checked = value === context.value;
  return (
    <ItemIndicatorContext.Provider value={checked}>
      <MenuItem
        role="menuitemradio"
        aria-checked={checked}
        {...radioItemProps}
        ref={forwardedRef}
        data-state={getCheckedState(checked)}
        onSelect={composeEventHandlers(
          radioItemProps.onSelect,
          () => context.onValueChange?.(value),
          { checkForDefaultPrevented: false }
        )}
      />
    </ItemIndicatorContext.Provider>
  );
}) as MenuRadioItemPrimitive;

MenuRadioItem.displayName = RADIO_ITEM_NAME;

/* -------------------------------------------------------------------------------------------------
 * MenuItemIndicator
 * -----------------------------------------------------------------------------------------------*/

const ITEM_INDICATOR_NAME = 'MenuItemIndicator';
const ITEM_INDICATOR_DEFAULT_TAG = 'span';

const ItemIndicatorContext = React.createContext(false);

type MenuItemIndicatorOwnProps = Polymorphic.Merge<
  Polymorphic.OwnProps<typeof Primitive>,
  {
    /**
     * Used to force mounting when more control is needed. Useful when
     * controlling animation with React animation libraries.
     */
    forceMount?: true;
  }
>;

type MenuItemIndicatorPrimitive = Polymorphic.ForwardRefComponent<
  typeof ITEM_INDICATOR_DEFAULT_TAG,
  MenuItemIndicatorOwnProps
>;

const MenuItemIndicator = React.forwardRef((props, forwardedRef) => {
  const { as = ITEM_INDICATOR_DEFAULT_TAG, forceMount, ...indicatorProps } = props;
  const checked = React.useContext(ItemIndicatorContext);
  return (
    <Presence present={forceMount || checked}>
      <Primitive
        {...indicatorProps}
        as={as}
        ref={forwardedRef}
        data-state={getCheckedState(checked)}
      />
    </Presence>
  );
}) as MenuItemIndicatorPrimitive;

MenuItemIndicator.displayName = ITEM_INDICATOR_NAME;

/* -------------------------------------------------------------------------------------------------
 * MenuSubMenu
 * -----------------------------------------------------------------------------------------------*/

const SUB_MENU_NAME = 'MenuSubMenu';

type MenuSubMenuContextValue = {
  triggerRef: React.RefObject<HTMLDivElement>;
  contentId: string;
  focusFirstItem: boolean;
  onMouseOpen(): void;
  onKeyboardOpen(): void;
};

const [SubMenuProvider, useSubMenuContext] = createContext<MenuSubMenuContextValue>(SUB_MENU_NAME);

type MenuSubMenuOwnProps = {
  open?: boolean;
  onOpenChange?(open: boolean): void;
  defaultOpen?: boolean;
};

const MenuSubMenu: React.FC<MenuSubMenuOwnProps> = (props) => {
  const { children, open: openProp, defaultOpen, onOpenChange } = props;
  const triggerRef = React.useRef<HTMLDivElement>(null);
  const [focusFirstItem, setFocusFirstItem] = React.useState(false);
  const [renderChildren, setRenderChildren] = React.useState(false);
  const [open = false, setOpen] = useControllableState({
    prop: openProp,
    defaultProp: defaultOpen,
    onChange: onOpenChange,
  });

  // we defer rendering of nested children until after the parent is ready
  // this is to ensure that measurements are applied correctly relative to the parent and
  // that dismissable layers are appended in the correct order when using controlled props
  React.useLayoutEffect(() => {
    setRenderChildren(true);
  }, []);

  return (
    <SubMenuProvider
      contentId={useId()}
      triggerRef={triggerRef}
      focusFirstItem={focusFirstItem}
      onMouseOpen={React.useCallback(() => {
        setOpen(true);
        setFocusFirstItem(false);
      }, [setOpen])}
      onKeyboardOpen={React.useCallback(() => {
        setOpen(true);
        setFocusFirstItem(true);
      }, [setOpen])}
    >
      <Menu open={open} onOpenChange={setOpen}>
        {renderChildren && children}
      </Menu>
    </SubMenuProvider>
  );
};

MenuSubMenu.displayName = SUB_MENU_NAME;

/* -------------------------------------------------------------------------------------------------
 * MenuSubMenuContent
 * -----------------------------------------------------------------------------------------------*/

const SUB_MENU_CONTENT_NAME = 'MenuSubMenuContent';

type MenuSubMenuContentOwnProps = Omit<
  Polymorphic.OwnProps<typeof MenuContent>,
  'portalled' | 'disableOutsidePointerEvents' | 'disableOutsideScroll'
>;
type MenuSubMenuContentPrimitive = Polymorphic.ForwardRefComponent<
  Polymorphic.IntrinsicElement<typeof MenuContent>,
  MenuSubMenuContentOwnProps
>;

const MenuSubMenuContent = React.forwardRef((props, forwardedRef) => {
  const { ...contentProps } = props;
  const context = useMenuContext(SUB_MENU_CONTENT_NAME);
  const subMenuContext = useSubMenuContext(SUB_MENU_CONTENT_NAME);
  const trigger = subMenuContext.triggerRef.current;

  return (
    <MenuContent
      side="right"
      align="start"
      {...contentProps}
      portalled
      ref={forwardedRef}
      onOpenAutoFocus={composeEventHandlers(contentProps.onOpenAutoFocus, (event) => {
        const content = event.target as HTMLElement;
        if (content && subMenuContext.focusFirstItem) {
          const items = Array.from(content.querySelectorAll(ENABLED_ITEM_SELECTOR));
          (items[0] as HTMLElement | undefined)?.focus();
        }
      })}
      onKeyDown={composeEventHandlers(contentProps.onKeyDown, (event) => {
        if (event.key === 'ArrowLeft') {
          // only close a single level
          event.stopPropagation();
          context.onOpenChange(false);
          trigger?.focus();
        }
      })}
      onEscapeKeyDown={composeEventHandlers(contentProps.onEscapeKeyDown, () => trigger?.focus())}
      // prevent focusing previous element on close
      // this is important because we don't want to refocus menu triggers
      // when mouse scrubbing
      onCloseAutoFocus={composeEventHandlers(contentProps.onCloseAutoFocus, (event) =>
        event.preventDefault()
      )}
      onPointerDownOutside={composeEventHandlers(contentProps.onPointerDownOutside, (event) => {
        // the sub menu will remain open while the mouse is over the trigger
        // so we prevent it needlessly dismissing when clicking it
        if (trigger?.contains(event.target as HTMLElement)) {
          event.preventDefault();
        }
      })}
    />
  );
}) as MenuSubMenuContentPrimitive;

MenuSubMenuContent.displayName = SUB_MENU_CONTENT_NAME;

/* -------------------------------------------------------------------------------------------------
 * MenuSubMenuTrigger
 * -----------------------------------------------------------------------------------------------*/

const SUB_MENU_TRIGGER_NAME = 'MenuSubMenuTrigger';

type MenuSubMenuTriggerOwnProps = Polymorphic.Merge<
  Polymorphic.OwnProps<typeof MenuItem>,
  Polymorphic.OwnProps<typeof MenuAnchor>
>;
type MenuSubMenuTriggerPrimitive = Polymorphic.ForwardRefComponent<
  Polymorphic.IntrinsicElement<typeof MenuItem>,
  MenuSubMenuTriggerOwnProps
>;

const MenuSubMenuTrigger = React.forwardRef((props, forwardedRef) => {
  const { disabled, ...triggerProps } = props;
  const context = useMenuContext(SUB_MENU_TRIGGER_NAME);
  const subMenuContext = useSubMenuContext(SUB_MENU_TRIGGER_NAME);
  const [mouseInteracting, setMouseInteracting] = React.useState(false);

  return (
    <MenuAnchor as={Slot}>
      <MenuItem
        aria-haspopup="menu"
        aria-expanded={context.open ? true : undefined}
        aria-controls={context.open ? subMenuContext.contentId : undefined}
        data-state={getOpenState(context.open)}
        disabled={disabled}
        {...triggerProps}
        ref={composeRefs(forwardedRef, subMenuContext.triggerRef)}
        onSelect={composeEventHandlers(triggerProps.onSelect, (event) => {
          event.preventDefault();
          event.stopPropagation();
        })}
        onMouseMove={composeEventHandlers(triggerProps.onMouseMove, (event) => {
          // prevent refocusing trigger which causes premature menu close
          event.preventDefault();

          if (!disabled && !mouseInteracting && !context.open) {
            setMouseInteracting(true);
            event.currentTarget.focus();
          }
        })}
        onMouseLeave={composeEventHandlers(triggerProps.onMouseLeave, (event) => {
          // prevent focusing content which causes premature menu close
          event.preventDefault();
          setMouseInteracting(false);
        })}
        // hook into focus to prevent stuck open state after browser chrome takes focus e.g. devtools inspect overlay
        // this is because mouse events will continue to fire while the focus closing mechanism in `DismissableLayer` does not
        onFocus={composeEventHandlers(triggerProps.onFocus, (event) => {
          if (mouseInteracting) subMenuContext.onMouseOpen();
        })}
        onKeyDown={composeEventHandlers(triggerProps.onKeyDown, (event) => {
          setMouseInteracting(false);
          if (['Enter', ' ', 'ArrowRight'].includes(event.key)) subMenuContext.onKeyboardOpen();
        })}
      />
    </MenuAnchor>
  );
}) as MenuSubMenuTriggerPrimitive;

MenuSubMenuTrigger.displayName = SUB_MENU_TRIGGER_NAME;

/* ---------------------------------------------------------------------------------------------- */

const MenuAnchor = extendPrimitive(PopperPrimitive.Anchor, { displayName: 'MenuAnchor' });
const MenuGroup = extendPrimitive(Primitive, {
  defaultProps: { role: 'group' },
  displayName: 'MenuGroup',
});
const MenuLabel = extendPrimitive(Primitive, { displayName: 'MenuLabel' });
const MenuSeparator = extendPrimitive(Primitive, {
  defaultProps: { role: 'separator', 'aria-orientation': 'horizontal' },
  displayName: 'MenuSeparator',
});
const MenuArrow = extendPrimitive(PopperPrimitive.Arrow, { displayName: 'MenuArrow' });

/* -----------------------------------------------------------------------------------------------*/

function getOpenState(open: boolean) {
  return open ? 'open' : 'closed';
}

function getCheckedState(checked: boolean) {
  return checked ? 'checked' : 'unchecked';
}

function focusFirst(candidates: HTMLElement[]) {
  const PREVIOUSLY_FOCUSED_ELEMENT = document.activeElement;
  for (const candidate of candidates) {
    // if focus is already where we want to go, we don't want to keep going through the candidates
    if (candidate === PREVIOUSLY_FOCUSED_ELEMENT) return;
    candidate.focus();
    if (document.activeElement !== PREVIOUSLY_FOCUSED_ELEMENT) return;
  }
}

const Root = Menu;
const Anchor = MenuAnchor;
const Content = MenuContent;
const Group = MenuGroup;
const Label = MenuLabel;
const Item = MenuItem;
const CheckboxItem = MenuCheckboxItem;
const RadioGroup = MenuRadioGroup;
const RadioItem = MenuRadioItem;
const ItemIndicator = MenuItemIndicator;
const Separator = MenuSeparator;
const Arrow = MenuArrow;
const SubMenu = MenuSubMenu;
const SubMenuTrigger = MenuSubMenuTrigger;
const SubMenuContent = MenuSubMenuContent;

export {
  Menu,
  MenuAnchor,
  MenuContent,
  MenuGroup,
  MenuLabel,
  MenuItem,
  MenuCheckboxItem,
  MenuRadioGroup,
  MenuRadioItem,
  MenuItemIndicator,
  MenuSeparator,
  MenuArrow,
  MenuSubMenu,
  MenuSubMenuTrigger,
  MenuSubMenuContent,
  //
  Root,
  Anchor,
  Content,
  Group,
  Label,
  Item,
  CheckboxItem,
  RadioGroup,
  RadioItem,
  ItemIndicator,
  Separator,
  Arrow,
  SubMenu,
  SubMenuTrigger,
  SubMenuContent,
};
