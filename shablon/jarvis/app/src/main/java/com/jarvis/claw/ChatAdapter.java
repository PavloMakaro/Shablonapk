package com.jarvis.claw;

import android.content.Context;
import android.text.Html;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ArrayAdapter;
import android.widget.LinearLayout;
import android.widget.TextView;

import java.util.List;

public class ChatAdapter extends ArrayAdapter<ChatMessage> {

    private int resUser;
    private int resBot;

    public ChatAdapter(Context context, List<ChatMessage> objects) {
        super(context, 0, objects);
        resUser = R.layout.item_message_user;
        resBot = R.layout.item_message_bot;
    }

    @Override
    public int getViewTypeCount() {
        return 2;
    }

    @Override
    public int getItemViewType(int position) {
        return getItem(position).type;
    }

    @Override
    public View getView(int position, View convertView, ViewGroup parent) {
        ChatMessage msg = getItem(position);
        int type = getItemViewType(position);

        if (convertView == null) {
            int layoutRes = type == ChatMessage.TYPE_USER ? resUser : resBot;
            convertView = LayoutInflater.from(getContext()).inflate(layoutRes, parent, false);
        }

        TextView tvMessage = convertView.findViewById(R.id.tvMessage);
        tvMessage.setText(msg.message);

        if (type == ChatMessage.TYPE_BOT) {
            LinearLayout llThinking = convertView.findViewById(R.id.llThinking);
            TextView tvThinking = convertView.findViewById(R.id.tvThinking);

            if (msg.isThinking) {
                llThinking.setVisibility(View.VISIBLE);
                tvThinking.setText(msg.thinkingText != null && !msg.thinkingText.isEmpty() ? msg.thinkingText : "Thinking...");
            } else {
                llThinking.setVisibility(View.GONE);
            }
        }

        return convertView;
    }
}