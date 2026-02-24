import React from 'react';
import cx from 'classnames';

import toggleIcon from '@plone/volto/icons/more.svg';

import Toolbar from '@plone/volto-slate/editor/ui/Toolbar';
import ExpandedToolbar from '@plone/volto-slate/editor/ui/ExpandedToolbar';
import ToolbarButton from '@plone/volto-slate/editor/ui/ToolbarButton';

import AIAssistantSlateButton from '../../../../../components/AIAssistant/AIAssistantSlateButton';

import config from '@plone/volto/registry';

const SlateToolbar = (props) => {
    const {
        selected,
        showExpandedToolbar,
        setShowExpandedToolbar,
        className,
        enableExpando = false,
        show,
    } = props;

    const slate = props.slateSettings || config.settings.slate;
    const {toolbarButtons, expandedToolbarButtons, buttons} = slate;

    function renderButton(name, index) {
        const Btn = buttons[name];
        if (!Btn) {
            console.warn('Button not found:', name);
            return null;
        }
        return <Btn key={`${name}-${index}`}/>;
    }

    return (
        <>
            {!showExpandedToolbar && (
                <Toolbar
                    show={show}
                    toggleButton={
                        enableExpando && (
                            <ToolbarButton
                                title="More..."
                                onMouseDown={(event) => {
                                    setShowExpandedToolbar(!showExpandedToolbar);
                                    event.preventDefault();
                                }}
                                icon={toggleIcon}
                                active={showExpandedToolbar}
                            />
                        )
                    }
                    className={className}
                >
                    {toolbarButtons?.map(renderButton)}

                    <AIAssistantSlateButton/>
                </Toolbar>
            )}

            <div
                className={cx('toolbar-wrapper', {
                    active: showExpandedToolbar && selected,
                })}
            >
                {selected && showExpandedToolbar && (
                    <ExpandedToolbar
                        show={show}
                        toggleButton={
                            <ToolbarButton
                                title="Less..."
                                onMouseDown={(event) => {
                                    setShowExpandedToolbar(!showExpandedToolbar);
                                    event.preventDefault();
                                }}
                                icon={toggleIcon}
                                active={showExpandedToolbar}
                            />
                        }
                    >
                        {expandedToolbarButtons?.map(renderButton)}

                        <AIAssistantSlateButton/>
                    </ExpandedToolbar>
                )}
            </div>
        </>
    );
};

export default SlateToolbar;
