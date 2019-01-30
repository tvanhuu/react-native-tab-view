/* @flow */

import * as React from 'react';
import { StyleSheet } from 'react-native';
import { PanGestureHandler, State } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';

import { Layout, NavigationState, Route } from './types';

const {
  Clock,
  Extrapolate,
  Value,
  onChange,
  abs,
  add,
  block,
  call,
  clockRunning,
  cond,
  divide,
  eq,
  event,
  greaterThan,
  interpolate,
  max,
  min,
  multiply,
  neq,
  or,
  round,
  set,
  spring,
  startClock,
  stopClock,
  sub,
} = Animated;

const TRUE = 1;
const FALSE = 0;

const SPRING_CONFIG = {
  damping: 40,
  mass: 1,
  stiffness: 200,
  overshootClamping: true,
  restSpeedThreshold: 0.01,
  restDisplacementThreshold: 0.01,
};

type Props<T: Route> = {
  swipeEnabled: boolean,
  jumpTo: (key: string) => mixed,
  navigationState: NavigationState<T>,
  layout: Layout,
  children: (props: {
    position: Animated.Node<number>,
    render: (children: React.ReactNode) => React.ReactNode,
  }) => React.ReactNode,
};

export default class Pager<T: Route> extends React.Component<Props<T>> {
  componentDidUpdate(prevProps: Props<T>) {
    const { index } = this.props.navigationState;

    if (index !== prevProps.navigationState.index) {
      this._nextIndex.setValue(index);
    }

    if (
      prevProps.navigationState.routes.length !==
      this.props.navigationState.routes.length
    ) {
      this._routesLength.setValue(this.props.navigationState.routes.length);
    }

    if (prevProps.layout.width !== this.props.layout.width) {
      this._layoutWidth.setValue(this.props.layout.width);
    }
  }

  _velocityX = new Value(0);
  _gestureX = new Value(0);
  _gestureState = new Value(-1);
  _offsetX = new Value(0);
  _dragging = new Value(FALSE);
  _position = new Value(0);
  _index = new Value(this.props.navigationState.index);
  _nextIndex = new Value(this.props.navigationState.index);
  _clock = new Clock();

  _routesLength = new Value(this.props.navigationState.routes.length);

  // tslint:disable-next-line: strict-boolean-expressions
  _layoutWidth = new Value(this.props.layout.width || 320);

  _swipeDistanceThreshold = divide(this._layoutWidth, 1.75);
  _swipeVelocityThreshold = 1200;

  transitionTo = (index: Animated.Node<number>) => {
    const state = {
      position: this._position,
      velocity: this._velocityX,
      time: new Value(0),
      finished: new Value(0),
    };

    const config = {
      ...SPRING_CONFIG,
      toValue: new Value(0),
    };

    return block([
      cond(clockRunning(this._clock), 0, [
        set(this._index, index),
        set(config.toValue, multiply(index, this._layoutWidth, -1)),
        set(state.finished, 0),
        set(state.time, 0),
        startClock(this._clock),
      ]),
      spring(this._clock, state, config),
      cond(state.finished, [
        stopClock(this._clock),
        call([this._index], ([value]) => {
          const route = this.props.navigationState.routes[Math.round(value)];

          this.props.jumpTo(route.key);
        }),
      ]),
    ]);
  };

  handleGestureEvent = event([
    {
      nativeEvent: {
        translationX: this._gestureX,
        velocityX: this._velocityX,
        state: this._gestureState,
      },
    },
  ]);

  translateX = block([
    onChange(
      this._nextIndex,
      cond(neq(this._index, this._nextIndex), [
        stopClock(this._clock),
        set(this._index, this._nextIndex),
      ])
    ),
    cond(
      eq(this._gestureState, State.ACTIVE),
      [
        cond(this._dragging, FALSE, [
          set(this._dragging, TRUE),
          set(this._offsetX, this._position),
        ]),
        set(this._position, add(this._offsetX, this._gestureX)),
        stopClock(this._clock),
      ],
      [
        set(this._dragging, FALSE),
        this.transitionTo(
          cond(
            or(
              greaterThan(abs(this._gestureX), this._swipeDistanceThreshold),
              greaterThan(abs(this._velocityX), this._swipeVelocityThreshold)
            ),
            round(
              min(
                max(
                  0,
                  sub(
                    this._index,
                    cond(
                      greaterThan(
                        abs(this._gestureX),
                        this._swipeDistanceThreshold
                      ),
                      divide(this._gestureX, abs(this._gestureX)),
                      divide(this._velocityX, abs(this._velocityX))
                    )
                  )
                ),
                sub(this._routesLength, 1)
              )
            ),
            this._index
          )
        ),
      ]
    ),

    this._position,
  ]);

  render() {
    const { layout, navigationState, swipeEnabled, children } = this.props;
    const maxTranslate = layout.width * (navigationState.routes.length - 1);
    const translateX = interpolate(this.translateX, {
      inputRange: [-maxTranslate, 0],
      outputRange: [-maxTranslate, 0],
      extrapolate: Extrapolate.CLAMP,
    });

    return children({
      position: divide(abs(translateX), layout.width),
      render: children => (
        <PanGestureHandler
          enabled={layout.width !== 0 && swipeEnabled}
          onGestureEvent={this.handleGestureEvent}
          onHandlerStateChange={this.handleGestureEvent}
          minDist={10}
          activeOffsetX={[-10, 10]}
        >
          <Animated.View
            // @ts-ignore
            style={[
              styles.container,
              layout.width
                ? {
                    width: layout.width * navigationState.routes.length,
                    transform: [{ translateX }],
                  }
                : null,
            ]}
          >
            {children}
          </Animated.View>
        </PanGestureHandler>
      ),
    });
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
  },
});
