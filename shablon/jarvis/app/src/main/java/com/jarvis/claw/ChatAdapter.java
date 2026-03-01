package com.jarvis.claw;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.support.v7.widget.RecyclerView;
import android.text.Html;
import android.view.Gravity;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;

import com.squareup.picasso.Picasso;

import java.util.List;

public class ChatAdapter extends RecyclerView.Adapter<ChatAdapter.ChatViewHolder> {

    private List<ChatMessage> messages;
    private Context context;
    private ChatMessage currentStreamingMessage = null;

    public ChatAdapter(List<ChatMessage> messages, Context context) {
        this.messages = messages;
        this.context = context;
    }

    @Override
    public ChatViewHolder onCreateViewHolder(ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(context).inflate(R.layout.item_chat_message, parent, false);
        return new ChatViewHolder(view);
    }

    @Override
    public void onBindViewHolder(ChatViewHolder holder, int position) {
        final ChatMessage msg = messages.get(position);

        // Reset visibility
        holder.tvMessage.setVisibility(View.VISIBLE);
        holder.ivActionImage.setVisibility(View.GONE);
        holder.btnAction.setVisibility(View.GONE);

        if (msg.isUser) {
            holder.llBubbleContainer.setGravity(Gravity.RIGHT);
            LinearLayout.LayoutParams params = (LinearLayout.LayoutParams) holder.llBubbleContainer.getLayoutParams();
            params.gravity = Gravity.RIGHT;
            holder.llBubbleContainer.setLayoutParams(params);

            holder.tvMessage.setBackgroundResource(R.drawable.bg_msg_user);
            holder.tvMessage.setTextColor(context.getResources().getColor(R.color.text_primary));
            holder.tvMessage.setText(msg.content);

        } else {
            holder.llBubbleContainer.setGravity(Gravity.LEFT);
            LinearLayout.LayoutParams params = (LinearLayout.LayoutParams) holder.llBubbleContainer.getLayoutParams();
            params.gravity = Gravity.LEFT;
            holder.llBubbleContainer.setLayoutParams(params);

            holder.tvMessage.setBackgroundResource(R.drawable.bg_msg_agent);
            holder.tvMessage.setTextColor(context.getResources().getColor(R.color.text_primary));

            // Basic Markdown/Streaming handling
            if (msg.isStreaming) {
                holder.tvMessage.setText(Html.fromHtml("<i>" + msg.content + "</i>..."));
            } else {
                holder.tvMessage.setText(msg.content);
            }

            // Handle Bot Actions
            if (msg.isAction && msg.actionFileUrl != null && !msg.actionFileUrl.isEmpty()) {
                if ("send_photo".equals(msg.actionType) || "send_image".equals(msg.actionType)) {
                    holder.ivActionImage.setVisibility(View.VISIBLE);
                    Picasso.with(context).load(msg.actionFileUrl).into(holder.ivActionImage);
                } else if ("send_video".equals(msg.actionType) || "send_audio".equals(msg.actionType) || "send_voice".equals(msg.actionType) || "send_file".equals(msg.actionType) || "send_document".equals(msg.actionType)) {
                    holder.btnAction.setVisibility(View.VISIBLE);
                    holder.btnAction.setText("Open " + msg.actionType.replace("send_", ""));
                    holder.btnAction.setOnClickListener(new View.OnClickListener() {
                        @Override
                        public void onClick(View v) {
                            Intent i = new Intent(Intent.ACTION_VIEW);
                            i.setData(Uri.parse(msg.actionFileUrl));
                            context.startActivity(i);
                        }
                    });
                }
            }
        }
    }

    @Override
    public int getItemCount() {
        return messages.size();
    }

    public void updateStreamingMessage(String text) {
        if (currentStreamingMessage == null || !currentStreamingMessage.isStreaming) {
            currentStreamingMessage = new ChatMessage(false, "");
            currentStreamingMessage.isStreaming = true;
            messages.add(currentStreamingMessage);
        }
        currentStreamingMessage.content = text;
        notifyItemChanged(messages.size() - 1);
    }

    public void appendStreamingMessage(String text) {
        if (currentStreamingMessage != null && currentStreamingMessage.isStreaming) {
            currentStreamingMessage.content += text;
            notifyItemChanged(messages.size() - 1);
        } else {
            // Failsafe
            updateStreamingMessage(text);
        }
    }

    public void finalizeStreamingMessage() {
        if (currentStreamingMessage != null) {
            currentStreamingMessage.isStreaming = false;
            notifyItemChanged(messages.size() - 1);
            currentStreamingMessage = null;
        }
    }

    static class ChatViewHolder extends RecyclerView.ViewHolder {
        LinearLayout llBubbleContainer;
        TextView tvMessage;
        ImageView ivActionImage;
        Button btnAction;

        ChatViewHolder(View itemView) {
            super(itemView);
            llBubbleContainer = (LinearLayout) itemView.findViewById(R.id.ll_bubble_container);
            tvMessage = (TextView) itemView.findViewById(R.id.tv_message);
            ivActionImage = (ImageView) itemView.findViewById(R.id.iv_action_image);
            btnAction = (Button) itemView.findViewById(R.id.btn_action);
        }
    }
}
