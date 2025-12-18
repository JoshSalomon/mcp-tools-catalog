#!/bin/bash
# Quick fix for MCP Catalog plugin not appearing in console

echo "MCP Catalog Console Plugin - Quick Fix"
echo "======================================"
echo ""

# Check if plugin is enabled
echo "Checking if plugin is enabled in console operator..."
ENABLED=$(oc get consoles.operator.openshift.io cluster -o jsonpath='{.spec.plugins}' 2>/dev/null | grep -c "mcp-catalog")

if [ "$ENABLED" -eq 0 ]; then
    echo "❌ Plugin is NOT enabled in console operator"
    echo ""
    echo "Enabling plugin now..."

    # Get current plugins
    CURRENT_PLUGINS=$(oc get consoles.operator.openshift.io cluster -o jsonpath='{.spec.plugins}' 2>/dev/null)

    if [ -z "$CURRENT_PLUGINS" ] || [ "$CURRENT_PLUGINS" == "null" ]; then
        # No plugins currently enabled
        echo "No other plugins detected. Enabling mcp-catalog..."
        oc patch consoles.operator.openshift.io cluster \
          --patch '{"spec":{"plugins":["mcp-catalog"]}}' \
          --type=merge
    else
        # Add to existing plugins
        echo "Current plugins: $CURRENT_PLUGINS"
        echo ""
        echo "⚠️  WARNING: This will REPLACE all plugins!"
        echo "Please run this command manually to preserve other plugins:"
        echo ""
        echo "oc patch consoles.operator.openshift.io cluster \\"
        echo "  --patch '{\"spec\":{\"plugins\":[\"mcp-catalog\",\"other-plugin-1\",\"other-plugin-2\"]}}' \\"
        echo "  --type=merge"
        echo ""
        read -p "Do you want to enable ONLY mcp-catalog? (y/N): " response
        if [[ "$response" =~ ^[Yy]$ ]]; then
            oc patch consoles.operator.openshift.io cluster \
              --patch '{"spec":{"plugins":["mcp-catalog"]}}' \
              --type=merge
        else
            echo "Aborted. Please enable the plugin manually."
            exit 0
        fi
    fi

    echo "✓ Plugin enabled!"
    echo ""
else
    echo "✓ Plugin is already enabled"
    echo ""
fi

# Force console reload
echo "Reloading console pods..."
oc delete pods -n openshift-console -l app=console

echo ""
echo "✓ Console pods deleted and will restart"
echo ""
echo "Next steps:"
echo "1. Wait 1-2 minutes for console pods to fully restart"
echo "2. Refresh your browser (Ctrl+Shift+R or Cmd+Shift+R for hard refresh)"
echo "3. Clear browser cache if needed"
echo "4. Check console - 'MCP Catalog' should appear in left navigation"
echo ""
echo "If still not appearing, run: ./diagnose-plugin.sh"
